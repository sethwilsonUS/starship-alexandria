import { EventEmitter } from 'events';

/**
 * Typed event names for Phaser ↔ React communication.
 * Add new events here as the game grows.
 */
export type EventBridgeEvents = {
  'player-moving': void;
  'player-moved': { x: number; y: number };
  'movement-blocked': { reason: string };
  'interaction-available': { type: string; label?: string };
  'interaction-triggered': { type: string; id?: string };
  /** Emitted by GameContainer after successfully handling an interaction. ExploreScene uses this to destroy/remove. */
  'interactive-consumed': { type: string; id?: string };
  'book-found': { fragmentId: string; bookId: string };
  'battery-found': { batteryId: string };
  'battery-used': void;
  'npc-dialogue': { npcId: string; lines: string[] };
  'area-entered': { areaName: string };
  'close-dialogue': void;
  'open-inventory': void;
  /** Ship scene events */
  'beam-up-confirmed': void;
  'beam-down-requested': void;
  /** Dialogue choice selection */
  'dialogue-choice': { action: string };
  /** Show welcome message to first-time players */
  'show-welcome': void;
  /** Open the map scene (from M key) */
  'open-map-scene': void;
  /** Room announcement TTS completed */
  'room-announcements-complete': void;
};

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
}

export const EventBridge = new EventBridgeClass();
