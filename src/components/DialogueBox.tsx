'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '@/game/EventBridge';
import { speak, cancelSpeech } from '@/utils/speech';
import { unlockInteractions } from '@/game/systems/Interaction';

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
  const closeDialogue = useGameStore((s) => s.actions.closeDialogue);
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedChars, setDisplayedChars] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const openedAtRef = useRef<number>(0);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  const lines = currentDialogue ?? [];
  const currentLine = lines[lineIndex];
  const isOpen = lines.length > 0;
  const hasChoices = currentLine?.choices && currentLine.choices.length > 0;
  
  const fullText = currentLine?.speaker
    ? `${currentLine.speaker}: ${currentLine.text}`
    : (currentLine?.text ?? '');
  const displayedText = fullText.slice(0, displayedChars);
  const isFullyRevealed = displayedChars >= fullText.length;

  // Clear typewriter on cleanup
  const clearTypewriter = useCallback(() => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
    setIsTyping(false);
  }, []);

  // Start typewriter when line changes
  useEffect(() => {
    if (!isOpen || !currentLine) return;
    
    clearTypewriter();
    setDisplayedChars(0);
    setIsTyping(true);
    
    typewriterRef.current = setInterval(() => {
      setDisplayedChars(prev => {
        const next = prev + 1;
        if (next >= fullText.length) {
          clearTypewriter();
        }
        return next;
      });
    }, TYPEWRITER_SPEED);
    
    return clearTypewriter;
  }, [isOpen, lineIndex, currentLine, fullText.length, clearTypewriter]);

  // Skip to full text or advance
  const skipOrAdvance = useCallback(() => {
    if (isTyping) {
      // Skip to end of current line
      clearTypewriter();
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

  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = Date.now();
    setLineIndex(0);
  }, [isOpen]);

  // TTS: speak current line when it changes (include choices and continuation hint)
  useEffect(() => {
    if (!isOpen || !currentLine) return;
    let text = currentLine.speaker
      ? `${currentLine.speaker}: ${currentLine.text}`
      : currentLine.text;
    if (currentLine.choices && currentLine.choices.length > 0) {
      const choiceText = currentLine.choices
        .map((c) => `Press ${c.key.toUpperCase()} for ${c.label}`)
        .join('. ');
      text += `. ${choiceText}`;
    } else {
      // Add continuation/close hint after a pause (... creates a pause in TTS)
      if (lineIndex < lines.length - 1) {
        text += ' ... Press space to continue.';
      } else {
        text += ' ... Press space to close.';
      }
    }
    speak(text);
    return () => cancelSpeech();
  }, [isOpen, lineIndex, currentLine, lines.length]);

  useEffect(() => {
    if (!isOpen) cancelSpeech();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      
      // Handle choice selection
      if (hasChoices && currentLine?.choices) {
        const choice = currentLine.choices.find(
          (c) => c.key.toLowerCase() === e.key.toLowerCase()
        );
        if (choice) {
          e.preventDefault();
          handleChoice(choice.action);
          return;
        }
      }
      
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        advance();
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        cancelSpeech();
        closeDialogue();
        unlockInteractions();
        setLineIndex(0);
        // Emit cancel action if there were choices
        if (hasChoices) {
          EventBridge.emit('dialogue-choice', { action: 'cancel' });
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, advance, closeDialogue, hasChoices, currentLine, handleChoice]);

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
      role="dialog"
      aria-modal="true"
      aria-label="Dialogue"
      aria-describedby="dialogue-text"
      className="dialogue-box"
    >
      <div className="dialogue-box__inner">
        <p id="dialogue-text" className="dialogue-box__text">
          {displayedText}
          {isTyping && <span className="dialogue-box__cursor">▌</span>}
        </p>
        {hasChoices && currentLine?.choices && isFullyRevealed ? (
          <div className="dialogue-box__choices" role="group" aria-label="Choices">
            {currentLine.choices.map((choice) => (
              <span key={choice.key} className="dialogue-box__choice">
                [{choice.key.toUpperCase()}] {choice.label}
              </span>
            ))}
          </div>
        ) : hintText ? (
          <p className="dialogue-box__hint" aria-hidden="true">
            {hintText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
