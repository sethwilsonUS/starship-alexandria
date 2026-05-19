'use client';

import { useEffect, useState } from 'react';
import { PhaserGame } from '@/PhaserGame';
import { EventBridge } from '@/game/EventBridge';
import { handleKeyboardInput } from '@/game/input/gameInput';
import type { GameInputAction } from '@/game/input/InputActionRouter';
import { useGameStore } from '@/store/gameStore';
import { getFragmentById, getBookCatalogSync } from '@/data/books';
import { getNPCById, getMarthaBookHint } from '@/data/npcs';
import { getJournalById } from '@/data/journalEntries';
import { getArtifactById } from '@/data/artifacts';
import { getGameloopCacheSync } from '@/utils/contentLoaderSync';
import { unlockInteractions } from '@/game/systems/Interaction';
import HUD from './HUD';
import AccessibleLog from './AccessibleLog';
import LibraryShelf from './LibraryShelf';
import MapOverlay from './MapOverlay';
import { getTransporterDialogue as getTransporterDialogueFromContent } from '@/utils/contentLoader';
import DialogueBox from './DialogueBox';
import BookDetail from './BookDetail';
import InteractionPrompt from './InteractionPrompt';
import DebugPanel from './DebugPanel';

function getTotalFragments(): number {
  try {
    const catalog = getBookCatalogSync();
    return catalog.reduce((n, b) => n + b.fragments.length, 0);
  } catch {
    return 0;
  }
}

function handleUseBatteryAction(): void {
  const { spareBatteries, flashlightBattery } = useGameStore.getState().player;

  if (spareBatteries === 0) {
    useGameStore.getState().actions.openDialogue([{ text: 'No spare batteries.' }]);
    return;
  }

  if (flashlightBattery > 50) {
    useGameStore.getState().actions.openDialogue([
      { text: `Flashlight is at ${flashlightBattery} percent. Save the battery for when it drops below 50.` },
    ]);
    return;
  }

  if (useGameStore.getState().actions.useBattery()) {
    EventBridge.emit('battery-used');
    const newBattery = useGameStore.getState().player.flashlightBattery;
    useGameStore.getState().actions.openDialogue([
      { text: `Battery used. Flashlight recharged to ${newBattery} percent.` },
    ]);
  }
}

function handleHudSummaryAction(): void {
  const state = useGameStore.getState();
  const { flashlightBattery, spareBatteries } = state.player;
  const { booksRemainingOnThisMap, exploredTiles, explorableTileCount } = state.session;
  const fragmentCount = state.library.length;

  const discoveryPercent =
    explorableTileCount > 0
      ? Math.round((exploredTiles.length / explorableTileCount) * 100)
      : 0;

  const parts: string[] = [];

  if (flashlightBattery > 75) {
    parts.push(`Flashlight at ${flashlightBattery} percent. Good condition.`);
  } else if (flashlightBattery > 50) {
    parts.push(`Flashlight at ${flashlightBattery} percent.`);
  } else if (flashlightBattery > 25) {
    parts.push(`Flashlight at ${flashlightBattery} percent. Getting low.`);
  } else {
    parts.push(`Flashlight at ${flashlightBattery} percent. Critically low.`);
  }

  if (spareBatteries === 0) {
    parts.push('No spare batteries.');
  } else if (spareBatteries === 1) {
    parts.push('1 spare battery.');
  } else {
    parts.push(`${spareBatteries} spare batteries.`);
  }

  if (booksRemainingOnThisMap === 0) {
    parts.push('No book fragments left in this area.');
  } else if (booksRemainingOnThisMap === 1) {
    parts.push('1 book fragment remaining.');
  } else {
    parts.push(`${booksRemainingOnThisMap} book fragments remaining.`);
  }

  const totalFragments = getTotalFragments();
  parts.push(`Collection progress: ${fragmentCount} of ${totalFragments} total.`);
  parts.push(`Area explored: ${discoveryPercent} percent.`);

  useGameStore.getState().actions.openDialogue([{ text: parts.join(' ... ') }]);
}

/**
 * Mounts Phaser canvas + UI overlays.
 * Subscribes to EventBridge; wires interaction-triggered → collectFragment (books) or dialogue (npc/journal/transporter).
 */
export default function GameContainer() {
  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardInput);
    return () => window.removeEventListener('keydown', handleKeyboardInput);
  }, []);

  useEffect(() => {
    const onInputAction = ({ action }: { action: GameInputAction }) => {
      if (action === 'useBattery') {
        handleUseBatteryAction();
      } else if (action === 'hudSummary') {
        handleHudSummaryAction();
      }
    };
    EventBridge.on('input-action', onInputAction);
    return () => {
      EventBridge.off('input-action', onInputAction);
    };
  }, []);

  useEffect(() => {
    const onInteractionTriggered = async (payload?: {
      type?: string;
      id?: string;
    }) => {
      const { type, id } = payload ?? {};
      if (!type) {
        unlockInteractions();
        return;
      }

      if (type === 'book' && id) {
        const fragment = await getFragmentById(id);
        if (fragment) {
          useGameStore.getState().actions.collectFragment(fragment);
          EventBridge.emit('book-found', { fragmentId: id, bookId: fragment.bookId });
          // Delay consumed event to ensure React has rendered
          setTimeout(() => {
            EventBridge.emit('interactive-consumed', { type: 'book', id });
          }, 100);
        } else {
          unlockInteractions();
        }
      } else if (type === 'npc' && id) {
        const npc = await getNPCById(id);
        if (npc) {
          const discovered = useGameStore.getState().exploration.discoveredNPCs.includes(id);
          const roomNames = useGameStore.getState().session.roomsWithBooksOnMap;
          const npcRooms = useGameStore.getState().session.npcRoomsOnMap;
          let lines: { speaker?: string; text: string }[];
          // Martha: contextual hint based on actual rooms with books this map
          if (npc.id === 'martha') {
            const hintLine = await getMarthaBookHint(roomNames);
            lines = discovered
              ? [npc.return[0], { speaker: 'Martha', text: hintLine }]
              : [...npc.firstMeet, { speaker: 'Martha', text: hintLine }];
          } else {
            lines = discovered ? npc.return : npc.firstMeet;
          }
          // Substitute dynamic templates (e.g., {{martha_room}})
          lines = substituteDialogueTemplates(lines, npcRooms);
          useGameStore.getState().actions.discoverNPC(id);
          useGameStore.getState().actions.openDialogue(lines);
        } else {
          unlockInteractions();
        }
      } else if (type === 'journal' && id) {
        // Special handling for dynamic vault hint journal
        if (id === 'journal-vault-hint') {
          const vaultInfo = useGameStore.getState().session.vaultInfo;
          if (vaultInfo) {
            const formattedCode = vaultInfo.code.split('').join('-');
            useGameStore.getState().actions.readJournal(id);
            useGameStore.getState().actions.openDialogue([
              { text: `If anyone finds this: the ${vaultInfo.roomName} vault code is ${formattedCode}. The director's birthday. They sealed it before they left. There's nothing down there worth dying for, they said. I think they were wrong.` }
            ]);
            setTimeout(() => {
              EventBridge.emit('interactive-consumed', { type: 'journal', id });
            }, 100);
          } else {
            unlockInteractions();
          }
        } else {
          const journal = await getJournalById(id);
          if (journal) {
            useGameStore.getState().actions.readJournal(id);
            useGameStore.getState().actions.openDialogue(journal.lines);
            setTimeout(() => {
              EventBridge.emit('interactive-consumed', { type: 'journal', id });
            }, 100);
          } else {
            unlockInteractions();
          }
        }
      } else if (type === 'battery' && id) {
        useGameStore.getState().actions.addBattery();
        EventBridge.emit('battery-found', { batteryId: id });
        EventBridge.emit('interactive-consumed', { type: 'battery', id });
        // Show dialogue for audio feedback (accessibility)
        const batteryCount = useGameStore.getState().player.spareBatteries;
        useGameStore.getState().actions.openDialogue([
          { text: `Battery collected! You now have ${batteryCount} spare ${batteryCount === 1 ? 'battery' : 'batteries'}. Press B to recharge your flashlight.` }
        ]);
      } else if (type === 'transporter') {
        const state = useGameStore.getState();
        const newFragmentsThisTrip = state.library.length - state.session.fragmentsAtExpeditionStart;
        const fragmentsRemaining = state.session.booksRemainingOnThisMap;
        
        const lines = await getTransporterDialogueFromContent(newFragmentsThisTrip, fragmentsRemaining);
        useGameStore.getState().actions.openDialogue(lines);
      } else if (type === 'map' && id) {
        useGameStore.getState().actions.collectMap();
        useGameStore.getState().actions.openDialogue([
          { text: 'You picked up the map.' }
        ]);
        setTimeout(() => {
          EventBridge.emit('interactive-consumed', { type: 'map', id });
        }, 100);
      } else if (type === 'vault') {
        const state = useGameStore.getState();
        const vaultInfo = state.session.vaultInfo;
        const hasReadHint = state.exploration.readJournals.includes('journal-vault-hint');
        const vaultOpened = state.session.vaultOpened;
        const gameloop = getGameloopCacheSync();
        
        if (vaultOpened) {
          const lines = gameloop.vault.alreadyOpened.map(line => ({ text: line.text }));
          useGameStore.getState().actions.openDialogue(lines);
        } else if (hasReadHint && vaultInfo) {
          const formattedCode = vaultInfo.code.split('').join('-');
          useGameStore.getState().actions.openVault();
          
          // Get the artifact from the vault
          const artifact = vaultInfo.artifactId ? getArtifactById(vaultInfo.artifactId) : null;
          
          if (artifact) {
            useGameStore.getState().actions.collectArtifact(artifact.id);
            const lines = gameloop.vault.openWithArtifact.map(line => ({
              text: line.text
                .replace('{code}', formattedCode)
                .replace('{artifactName}', artifact.name)
                .replace('{artifactDescription}', artifact.description)
            }));
            useGameStore.getState().actions.openDialogue(lines);
          } else {
            const lines = gameloop.vault.openEmpty.map(line => ({
              text: line.text.replace('{code}', formattedCode)
            }));
            useGameStore.getState().actions.openDialogue(lines);
          }
        } else {
          const lines = gameloop.vault.locked.map(line => ({ text: line.text }));
          useGameStore.getState().actions.openDialogue(lines);
        }
      } else {
        const lines = getDialogueForInteraction(type, id);
        if (lines.length > 0) {
          useGameStore.getState().actions.openDialogue(lines);
        } else {
          unlockInteractions();
        }
      }
    };
    EventBridge.on('interaction-triggered', onInteractionTriggered);
    return () => {
      EventBridge.off('interaction-triggered', onInteractionTriggered);
    };
  }, []);

  // Handle dialogue choices (for transporter confirmation)
  useEffect(() => {
    const onDialogueChoice = ({ action }: { action: string }) => {
      if (action === 'beam-up') {
        EventBridge.emit('beam-up-confirmed');
      }
      // 'stay' and 'cancel' just close dialogue (already handled)
    };
    EventBridge.on('dialogue-choice', onDialogueChoice);
    return () => {
      EventBridge.off('dialogue-choice', onDialogueChoice);
    };
  }, []);

  // Handle welcome message for first-time players
  useEffect(() => {
    const onShowWelcome = () => {
      const gameloop = getGameloopCacheSync();
      const welcomeLines = gameloop.welcome.lines.map(line => ({ text: line.text }));
      useGameStore.getState().actions.openDialogue(welcomeLines);
      useGameStore.getState().actions.setHasSeenWelcome();
    };
    EventBridge.on('show-welcome', onShowWelcome);
    return () => {
      EventBridge.off('show-welcome', onShowWelcome);
    };
  }, []);

  // Handle victory message when all fragments collected
  useEffect(() => {
    const onShowVictory = () => {
      const gameloop = getGameloopCacheSync();
      const victoryLines = gameloop.victory.lines.map(line => ({ text: line.text }));
      useGameStore.getState().actions.openDialogue(victoryLines);
    };
    EventBridge.on('show-victory', onShowVictory);
    return () => {
      EventBridge.off('show-victory', onShowVictory);
    };
  }, []);

  return (
    <div className="game-container">
      <PhaserGame />
      <HUD />
      <AccessibleLog />
      <LibraryShelf />
      <MapOverlay />
      <DialogueBox />
      <BookDetail />
      <InteractionPrompt />
      <DebugPanel />
    </div>
  );
}

function getDialogueForInteraction(
  type: string,
  _id?: string
): { text: string }[] {
  switch (type) {
    default:
      return [];
  }
}

/**
 * Substitute template placeholders in dialogue lines.
 * Supports: {{martha_room}}, {{eli_room}}, {{cora_room}} etc.
 * Falls back to generic text if NPC not on this map.
 */
function substituteDialogueTemplates(
  lines: { speaker?: string; text: string }[],
  npcRooms: Record<string, string>
): { speaker?: string; text: string }[] {
  return lines.map((line) => {
    let text = line.text;
    // Replace {{npcname_room}} with actual room name
    text = text.replace(/\{\{(\w+)_room\}\}/g, (match, npcId) => {
      const room = npcRooms[npcId];
      if (room) {
        return room;
      }
      // NPC not on this map - use generic fallback
      return 'ruins somewhere';
    });
    return { ...line, text };
  });
}
