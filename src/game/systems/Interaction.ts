import { Scene } from 'phaser';
import { EventBridge } from '../EventBridge';
import { useGameStore } from '@/store/gameStore';
import type { IControllablePlayer, Interactive } from '@/types/game';
import { speak, playDiscoveryChime } from '@/utils/speech';

const INTERACTION_BLOCKED_PHASES: readonly string[] = ['dialogue', 'reading', 'viewing-map'];

// Global lock to prevent interaction processing during state transitions
let interactionLocked = false;
export function lockInteractions() { interactionLocked = true; }
export function unlockInteractions() { interactionLocked = false; }

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
  private boundKeyHandler: ((e: KeyboardEvent) => void) | null = null;
  private isPlayerMoving = false;
  private lastInteractionTime = 0;
  private announcementsReady = false; // Wait for room announcements before announcing interactives
  private lastAnnouncedId: string | null = null; // Prevent double-announcing same interactive
  private onPlayerMoving = () => { this.isPlayerMoving = true; };
  private onPlayerMoved = () => { this.isPlayerMoving = false; };
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

    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.repeat) return; // Ignore key repeats
      if (e.code === 'KeyE' || e.code === 'Space') {
        // Cooldown: ignore interactions within 300ms of last one
        const now = Date.now();
        if (now - this.lastInteractionTime < 300) return;
        
        const gamePhase = useGameStore.getState().session.gamePhase;
        if (INTERACTION_BLOCKED_PHASES.includes(gamePhase)) return;
        
        // Auto-unlock if we're in exploring phase (safeguard against stuck lock)
        if (gamePhase === 'exploring') {
          interactionLocked = false;
        }
        
        // Check global lock (only blocks during state transitions)
        if (interactionLocked) return;
        
        const target = this.currentInteractive;
        if (!target) return;
        
        this.lastInteractionTime = now;
        e.preventDefault();
        
        // Lock interactions before emitting
        interactionLocked = true;
        
        // Emit immediately - the cooldown and lock prevent double-triggering
        EventBridge.emit('interaction-triggered', {
          type: target.type,
          id: target.id,
        });
      }
    };
    scene.input.keyboard!.on('keydown', this.boundKeyHandler);
    EventBridge.on('player-moving', this.onPlayerMoving);
    EventBridge.on('player-moved', this.onPlayerMoved);
    EventBridge.on('room-announcements-complete', this.onAnnouncementsComplete);
    scene.events.once('shutdown', () => this.detach());
  }

  detach(): void {
    EventBridge.off('player-moving', this.onPlayerMoving);
    EventBridge.off('player-moved', this.onPlayerMoved);
    EventBridge.off('room-announcements-complete', this.onAnnouncementsComplete);
    if (this.scene?.input?.keyboard && this.boundKeyHandler) {
      this.scene.input.keyboard.off('keydown', this.boundKeyHandler);
    }
    this.scene = null;
    this.player = null;
    this.interactives = [];
    this.currentInteractive = null;
    this.boundKeyHandler = null;
    this.announcementsReady = false;
    this.lastAnnouncedId = null;
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

    const found = this.interactives.find((i) => {
      const range = i.interactionRange ?? 'on';
      if (range === 'on') {
        return i.gridX === pos.x && i.gridY === pos.y;
      }
      // adjacent: manhattan distance 1 (standing next to NPC)
      const dx = Math.abs(pos.x - i.gridX);
      const dy = Math.abs(pos.y - i.gridY);
      return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
    });

    if (found && found.id !== this.currentInteractive?.id) {
      this.currentInteractive = found;
      EventBridge.emit('interaction-available', {
        type: found.type,
        label: found.label,
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
    
    // Play discovery chime for items (not transporter)
    if (['book', 'journal', 'battery', 'map'].includes(interactive.type)) {
      playDiscoveryChime();
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
      case 'battery':
        announcement = `Battery. ${keyHint}.`;
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
