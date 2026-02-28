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
    const onInteractionAvailable = ({ type, label }: { type: string; label?: string }) => {
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

  const displayText = `[E] ${prompt.label ?? prompt.type}`;

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
