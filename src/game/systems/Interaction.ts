import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import type { IControllablePlayer, Interactive } from '@/types/game';
import { speak, playDiscoveryChime } from '@/utils/speech';
import type { GameInputAction } from '@/game/input/InputActionRouter';
import { resolveInteractionTarget } from '@/game/player/playerContract';

const INTERACTION_BLOCKED_PHASES: readonly string[] = ['dialogue', 'reading', 'viewing-map'];

const interactionUnlockListeners = new Set<() => void>();

export function unlockInteractions() {
  interactionUnlockListeners.forEach((listener) => listener());
}

/**
 * Proximity-based interaction detection.
 * 'on' interactives (books, journals, transporter): prompt when standing ON the tile.
 * 'adjacent' interactives (NPCs): prompt when standing next to the tile (solid, block movement).
 * Emits interaction-available and interaction-triggered via EventBridge.
 */
export class InteractionSystem {
  private scene: Scene | null = null;
  private player: IControllablePlayer | null = null;
  private interactives: Interactive[] = [];
  private currentInteractive: Interactive | null = null;
  private boundKeyHandler: (({ action }: { action: GameInputAction }) => void) | null = null;
  private isPlayerMoving = false;
  private lastInteractionTime = 0;
  private interactionInFlight = false;
  private announcementsReady = false; // Wait for room announcements before announcing interactives
  private lastAnnouncedId: string | null = null; // Prevent double-announcing same interactive
  private onPlayerMoving = () => { this.isPlayerMoving = true; };
  private onPlayerMoved = () => { this.isPlayerMoving = false; };
  private onInteractionUnlocked = () => {
    this.interactionInFlight = false;
  };
  private onAnnouncementsComplete = () => {
    const wasReady = this.announcementsReady;
    this.announcementsReady = true;
    // Only announce on first completion (initial spawn), not subsequent room entries
    if (!wasReady && this.currentInteractive) {
      this.announceInteractive(this.currentInteractive);
    }
  };

  /** Register an interactive object (called when entities spawn) */
  register(interactive: Interactive): void {
    if (!this.interactives.some((i) => i.id === interactive.id)) {
      this.interactives.push(interactive);
    }
  }

  unregister(id: string): void {
    this.interactives = this.interactives.filter((i) => i.id !== id);
    if (this.currentInteractive?.id === id) {
      this.currentInteractive = null;
      EventBridge.emit('interaction-available', { type: '', label: undefined });
    }
  }

  /** Attach to scene and player; call from ExploreScene.create() */
  attach(scene: Scene, player: IControllablePlayer): void {
    this.scene = scene;
    this.player = player;
    this.announcementsReady = false;
    this.interactionInFlight = false;
    interactionUnlockListeners.add(this.onInteractionUnlocked);

    this.boundKeyHandler = ({ action }: { action: GameInputAction }) => {
      if (action !== 'interact') return;

      const now = Date.now();
      if (now - this.lastInteractionTime < 300) return;

      const gamePhase = useGameStore.getState().session.gamePhase;
      if (INTERACTION_BLOCKED_PHASES.includes(gamePhase)) return;
      if (this.interactionInFlight) return;

      const target = this.currentInteractive;
      if (!target) return;

      this.lastInteractionTime = now;
      this.interactionInFlight = true;
      EventBridge.emit('interaction-triggered', {
        type: target.type,
        id: target.id,
      });
    };
    EventBridge.on('input-action', this.boundKeyHandler);
    EventBridge.on('player-moving', this.onPlayerMoving);
    EventBridge.on('player-moved', this.onPlayerMoved);
    EventBridge.on('room-announcements-complete', this.onAnnouncementsComplete);
    scene.events.once('shutdown', () => this.detach());
  }

  detach(): void {
    if (this.currentInteractive) {
      EventBridge.emit('interaction-available', { type: '', label: undefined });
    }
    EventBridge.off('player-moving', this.onPlayerMoving);
    EventBridge.off('player-moved', this.onPlayerMoved);
    EventBridge.off('room-announcements-complete', this.onAnnouncementsComplete);
    interactionUnlockListeners.delete(this.onInteractionUnlocked);
    if (this.boundKeyHandler) {
      EventBridge.off('input-action', this.boundKeyHandler);
    }
    this.scene = null;
    this.player = null;
    this.interactives = [];
    this.currentInteractive = null;
    this.boundKeyHandler = null;
    this.announcementsReady = false;
    this.lastAnnouncedId = null;
    this.interactionInFlight = false;
  }

  /** Call every frame; only shows prompt when standing on the interactive tile */
  update(): void {
    if (!this.player) return;

    if (this.isPlayerMoving) {
      if (this.currentInteractive) {
        this.currentInteractive = null;
        EventBridge.emit('interaction-available', { type: '', label: undefined });
      }
      return;
    }

    const pos = this.player.getGridPosition();

    const targetResult = resolveInteractionTarget(
      pos,
      this.interactives.map((interactive) => ({
        id: interactive.id,
        type: interactive.type,
        label: interactive.label,
        position: { x: interactive.gridX, y: interactive.gridY },
        range: interactive.interactionRange ?? 'on',
      })),
    );
    const found = targetResult.type === 'interaction.available'
      ? this.interactives.find((interactive) => interactive.id === targetResult.target.id)
      : undefined;

    if (found && found.id !== this.currentInteractive?.id) {
      this.currentInteractive = found;
      EventBridge.emit('interaction-available', {
        type: found.type,
        label: found.label,
        id: found.id,
      });
      
      // Audio announcement for accessibility
      this.announceInteractive(found);
    } else if (!found && this.currentInteractive) {
      this.currentInteractive = null;
      this.lastAnnouncedId = null; // Reset so re-stepping on it will announce again
      EventBridge.emit('interaction-available', { type: '', label: undefined });
    } else if (found) {
      this.currentInteractive = found;
    }
  }

  private announceInteractive(interactive: Interactive): void {
    // Don't announce during startup (wait for room-announcements-complete event)
    if (!this.announcementsReady) return;
    
    // Don't re-announce the same interactive
    if (interactive.id === this.lastAnnouncedId) return;
    this.lastAnnouncedId = interactive.id;
    
    // Play discovery chime for items (not transporter); each kind has a motif
    if (interactive.type === 'book' || interactive.type === 'journal' || interactive.type === 'map') {
      playDiscoveryChime(interactive.type);
    }
    
    // Build announcement based on type
    const keyHint = interactive.type === 'npc' ? 'E or Space to talk' : 'E or Space to interact';
    let announcement = '';
    
    switch (interactive.type) {
      case 'book':
        announcement = `Book fragment: ${interactive.label}. ${keyHint}.`;
        break;
      case 'journal':
        announcement = `Journal: ${interactive.label}. ${keyHint}.`;
        break;
      case 'map':
        announcement = `Area map. ${keyHint}.`;
        break;
      case 'npc':
        announcement = `${interactive.label}. ${keyHint}.`;
        break;
      case 'transporter':
        announcement = `Transporter pad. ${keyHint} to beam up.`;
        break;
      default:
        announcement = `${interactive.label}. ${keyHint}.`;
    }
    
    speak(announcement);
  }
}
