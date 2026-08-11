import { EventEmitter } from 'events';
import type { GameInputAction } from './input/InputActionRouter';
import type { SavedThemeId } from '@/store/saveMigration';
import type { FootstepSurface } from './expeditions';

/**
 * Typed event names for Phaser ↔ React communication.
 * Add new events here as the game grows.
 */
export type EventBridgeEvents = {
  'player-moving': void;
  'player-moved': { x: number; y: number; surface: FootstepSurface };
  'movement-blocked': { reason: string };
  'interaction-available': { type: string; label?: string; id?: string };
  'interaction-triggered': { type: string; id?: string };
  /** Emitted by GameContainer after successfully handling an interaction. ExploreScene uses this to destroy/remove. */
  'interactive-consumed': { type: string; id?: string };
  'book-found': { fragmentId: string; bookId: string };
  'npc-dialogue': { npcId: string; lines: string[] };
  'area-entered': { areaName: string };
  'area-discovered': { areaName: string };
  /** Accessible DOM counterpart for the destination title card rendered on canvas. */
  'location-card': { title: string; kicker: string };
  'close-dialogue': void;
  'open-inventory': void;
  /** Ship scene events */
  'beam-up-confirmed': void;
  'beam-down-requested': { themeId: SavedThemeId };
  /** Fresh user gesture accepted; audio and onboarding may begin. */
  'launch-accepted': void;
  /** Dialogue choice selection */
  'dialogue-choice': { action: string };
  /** Room announcement TTS completed */
  'room-announcements-complete': void;
  /** Show victory message when all fragments collected */
  'show-victory': void;
  /** Semantic gameplay input routed from browser/React to game systems */
  'input-action': { action: GameInputAction };
  /** Debug: despawn all books on current map */
  'debug-despawn-all-books': void;
  /** Vault interaction - player attempts to open vault */
  'vault-interaction': { vaultId: string; code: string; roomName: string };
  'vault-opened': { vaultId: string };
};

type MessageUnion<Keys extends keyof EventBridgeEvents> = {
  [Key in Keys]: EventBridgeEvents[Key] extends void
    ? { type: Key }
    : { type: Key; payload: EventBridgeEvents[Key] }
}[Keys];

export type GameCommand = MessageUnion<
  | 'input-action'
  | 'beam-down-requested'
  | 'beam-up-confirmed'
  | 'dialogue-choice'
  | 'launch-accepted'
>;

export type GameEvent = MessageUnion<Exclude<keyof EventBridgeEvents, GameCommand['type']>>;

/**
 * Singleton EventBridge for Phaser ↔ React communication.
 * Phaser scenes emit events; React components subscribe and render UI.
 * Never import React components into Phaser or vice versa.
 */
class EventBridgeClass extends EventEmitter {
  emit<K extends keyof EventBridgeEvents>(
    event: K,
    ...args: EventBridgeEvents[K] extends void ? [] : [EventBridgeEvents[K]]
  ): boolean {
    return super.emit(event, ...(args as unknown[]));
  }

  on<K extends keyof EventBridgeEvents>(
    event: K,
    listener: (
      ...args: EventBridgeEvents[K] extends void ? [] : [EventBridgeEvents[K]]
    ) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof EventBridgeEvents>(
    event: K,
    listener: (
      ...args: EventBridgeEvents[K] extends void ? [] : [EventBridgeEvents[K]]
    ) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof EventBridgeEvents>(
    event: K,
    listener: (
      ...args: EventBridgeEvents[K] extends void ? [] : [EventBridgeEvents[K]]
    ) => void
  ): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  /** Subscribe with an exact, idempotent cleanup function for React Strict Mode. */
  subscribe<K extends keyof EventBridgeEvents>(
    event: K,
    listener: (
      ...args: EventBridgeEvents[K] extends void ? [] : [EventBridgeEvents[K]]
    ) => void,
  ): () => void {
    this.on(event, listener);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.off(event, listener);
    };
  }
}

export const EventBridge = new EventBridgeClass();
