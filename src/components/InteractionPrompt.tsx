'use client';

import { useState, useEffect } from 'react';
import { EventBridge } from '@/game/EventBridge';

/**
 * Interaction prompt: "[E] {label}" — rendered as DOM to avoid Phaser Text/WebGL bugs.
 * Fixed position at bottom center; WCAG contrast.
 */
export default function InteractionPrompt() {
  const [prompt, setPrompt] = useState<{ type: string; label?: string } | null>(null);

  useEffect(() => {
    const onInteractionAvailable = (payload?: { type?: string; label?: string }) => {
      const { type, label } = payload ?? {};
      if (type) {
        setPrompt({ type, label });
      } else {
        setPrompt(null);
      }
    };
    EventBridge.on('interaction-available', onInteractionAvailable);
    return () => {
      EventBridge.off('interaction-available', onInteractionAvailable);
    };
  }, []);

  if (!prompt) return null;

  const label = prompt.label ?? prompt.type;
  const displayText = prompt.type === 'npc'
    ? `[E] Talk to ${label}`
    : prompt.type === 'book'
      ? `[E] Read book fragment: ${label}`
      : prompt.type === 'journal'
        ? `[E] Read ${label}`
        : prompt.type === 'map'
          ? `[E] Take area map: ${label}`
          : prompt.type === 'vault'
            ? `[E] Inspect ${label}`
            : prompt.type === 'transporter'
              ? `[E] Use ${label}`
              : `[E] Take ${label}`;

  return (
    <div
      className="interaction-prompt"
      role="status"
      aria-live="polite"
      aria-label={displayText}
    >
      {displayText}
    </div>
  );
}
