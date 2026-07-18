'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '@/game/EventBridge';
import { speak, cancelSpeech } from '@/utils/speech';
import { unlockInteractions } from '@/game/systems/Interaction';
import { isNativeInteractiveTarget } from '@/utils/domEvents';
import { useModalFocus } from './useModalFocus';
import { useReducedMotion } from './useReducedMotion';

const TYPEWRITER_SPEED = 30; // ms per character

/**
 * Dialogue overlay. Renders lines one at a time with typewriter effect.
 * Advance with Space/Enter; close when dialogue ends.
 * Lines with `choices` show selectable options (press indicated key).
 * role="dialog" aria-modal="true" for accessibility.
 * TTS reads each line aloud when shown.
 */
export default function DialogueBox() {
  const currentDialogue = useGameStore((s) => s.session.currentDialogue);
  const ttsEnabled = useGameStore((s) => s.settings.narrationEnabled);
  const reducedMotion = useReducedMotion();
  const closeDialogue = useGameStore((s) => s.actions.closeDialogue);
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const openedAtRef = useRef<number>(0);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const lines = currentDialogue ?? [];
  const currentLine = lines[lineIndex];
  const isOpen = lines.length > 0;
  const hasChoices = currentLine?.choices && currentLine.choices.length > 0;
  const hasRecordedNarration = Boolean(currentLine?.voiceLineId && !hasChoices);
  
  const fullText = currentLine?.speaker
    ? `${currentLine.speaker}: ${currentLine.text}`
    : (currentLine?.text ?? '');
  const displayedText = fullText.slice(0, displayedChars);
  const isFullyRevealed = displayedChars >= fullText.length;

  const close = useCallback(() => {
    cancelSpeech();
    closeDialogue();
    unlockInteractions();
    setLineIndex(0);
    if (hasChoices) EventBridge.emit('dialogue-choice', { action: 'cancel' });
  }, [closeDialogue, hasChoices]);

  useModalFocus(isOpen, dialogRef, close);

  // Clear typewriter timer without touching React state; callers decide state.
  const clearTypewriter = useCallback(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
  }, []);

  // Start typewriter when line changes
  useEffect(() => {
    if (!isOpen || !currentLine) return;

    const frame = requestAnimationFrame(() => {
      clearTypewriter();
      if (reducedMotion) {
        setDisplayedChars(fullText.length);
        setIsTyping(false);
        return;
      }
      setDisplayedChars(0);
      setIsTyping(true);

      typewriterRef.current = setInterval(() => {
        setDisplayedChars(prev => {
          const next = prev + 1;
          if (next >= fullText.length) {
            clearTypewriter();
            setIsTyping(false);
          }
          return next;
        });
      }, TYPEWRITER_SPEED);
    });

    return () => {
      cancelAnimationFrame(frame);
      clearTypewriter();
    };
  }, [isOpen, lineIndex, currentLine, fullText.length, clearTypewriter, reducedMotion]);

  // Skip to full text or advance
  const skipOrAdvance = useCallback(() => {
    if (isTyping) {
      // Skip to end of current line
      clearTypewriter();
      setIsTyping(false);
      setDisplayedChars(fullText.length);
      return;
    }
    // Advance to next line
    if (hasChoices) return;
    if (lineIndex < lines.length - 1) {
      setLineIndex((i) => i + 1);
    } else {
      cancelSpeech();
      closeDialogue();
      unlockInteractions();
      setLineIndex(0);
    }
  }, [isTyping, clearTypewriter, fullText.length, hasChoices, lineIndex, lines.length, closeDialogue]);

  const advance = useCallback(() => {
    const timeSinceOpen = Date.now() - openedAtRef.current;
    
    // Ignore advances within 300ms of opening (prevents accidental instant close)
    if (timeSinceOpen < 300) return;
    
    skipOrAdvance();
  }, [skipOrAdvance]);

  const handleChoice = useCallback((action: string) => {
    cancelSpeech();
    closeDialogue();
    unlockInteractions();
    setLineIndex(0);
    EventBridge.emit('dialogue-choice', { action });
  }, [closeDialogue]);

  const playRecordedNarration = useCallback(() => {
    if (!currentLine?.voiceLineId) return;

    speak(currentLine.text, { voiceLineId: currentLine.voiceLineId });
  }, [currentLine]);

  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = Date.now();
    const frame = requestAnimationFrame(() => setLineIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  // TTS: speak current line when it changes (include choices and continuation hint)
  useEffect(() => {
    if (!isOpen || !currentLine) return;
    const authoredText = currentLine.speaker
      ? `${currentLine.speaker}: ${currentLine.text}`
      : currentLine.text;
    let text = authoredText;
    let voiceLineId: string | undefined;

    if (currentLine.choices && currentLine.choices.length > 0) {
      const choiceText = currentLine.choices
        .map((c) => `Press ${c.key.toUpperCase()} for ${c.label}`)
        .join('. ');
      text += `. ${choiceText}`;
    } else if (currentLine.voiceLineId && text === currentLine.text) {
      voiceLineId = currentLine.voiceLineId;
    } else {
      // Add continuation/close hint after a pause (... creates a pause in TTS)
      if (lineIndex < lines.length - 1) {
        text += ' ... Press space to continue.';
      } else {
        text += ' ... Press space to close.';
      }
    }
    speak(text, { voiceLineId });
    return () => cancelSpeech();
  }, [isOpen, lineIndex, currentLine, lines.length]);

  useEffect(() => {
    if (!isOpen) cancelSpeech();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const consumeDialogKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isNativeInteractiveTarget(e.target)) return;
      
      // Handle choice selection
      if (hasChoices && currentLine?.choices) {
        const choice = currentLine.choices.find(
          (c) => c.key.toLowerCase() === e.key.toLowerCase()
        );
        if (choice) {
          consumeDialogKey(e);
          handleChoice(choice.action);
          return;
        }
      }
      
      if (e.code === 'Space' || e.code === 'Enter') {
        consumeDialogKey(e);
        advance();
      }
      if (e.code === 'Escape') {
        consumeDialogKey(e);
        close();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, advance, close, hasChoices, currentLine, handleChoice]);

  if (!isOpen) return null;

  // Determine hint text based on state
  const getHintText = () => {
    if (isTyping) return 'Press Space to skip';
    if (hasChoices) return null;
    if (lineIndex < lines.length - 1) return 'Press Space or Enter to continue';
    return 'Press Space or Enter to close';
  };
  const hintText = getHintText();

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Dialogue"
      aria-describedby="dialogue-text"
      className="dialogue-box"
      tabIndex={-1}
    >
      <div className="dialogue-box__inner">
        <button type="button" className="modal-close dialogue-box__close" onClick={close} aria-label="Close dialogue">
          <span aria-hidden="true">×</span>
        </button>
        <p id="dialogue-text" className="dialogue-box__text">
          {displayedText}
          {isTyping && <span className="dialogue-box__cursor">▌</span>}
        </p>
        {hasChoices && currentLine?.choices && isFullyRevealed ? (
          <div className="dialogue-box__choices" role="group" aria-label="Choices">
            {currentLine.choices.map((choice, index) => (
              <button
                key={choice.key}
                type="button"
                className="dialogue-box__choice"
                onClick={() => handleChoice(choice.action)}
                data-autofocus={index === 0 ? '' : undefined}
              >
                <span aria-hidden="true">[{choice.key.toUpperCase()}]</span> {choice.label}
              </button>
            ))}
          </div>
        ) : null}
        {hasRecordedNarration && ttsEnabled ? (
          <div className="dialogue-box__voice-controls">
            <button
              type="button"
              className="dialogue-box__voice-btn"
              onClick={playRecordedNarration}
            >
              Play narration
            </button>
            <span className="dialogue-box__voice-note">
              AI-generated voice clip
            </span>
          </div>
        ) : null}
        {hintText ? (
          <p className="dialogue-box__hint" aria-hidden="true">
            {hintText}
          </p>
        ) : null}
        {!hasChoices ? (
          <button type="button" className="dialogue-box__advance" onClick={advance} data-autofocus>
            {isTyping ? 'Show full line' : lineIndex < lines.length - 1 ? 'Continue' : 'Close'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
