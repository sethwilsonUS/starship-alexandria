'use client';

import { useEffect, useState } from 'react';
import { PhaserGame } from './PhaserGame';
import { EventBridge } from '@/game/EventBridge';
import { handleKeyboardInput } from '@/game/input/gameInput';
import type { GameInputAction } from '@/game/input/InputActionRouter';
import { useGameStore } from '@/store/gameStore';
import { getFragmentById, getBookCatalogSync } from '@/data/books';
import { getNPCById, getMarthaBookHint } from '@/data/npcs';
import { getJournalById } from '@/data/journalEntries';
import { getGameloopCacheSync } from '@/utils/contentLoaderSync';
import { unlockInteractions } from '@/game/systems/Interaction';
import HUD from './HUD';
import AccessibleLog from './AccessibleLog';
import LibraryShelf from './LibraryShelf';
import MapOverlay from './MapOverlay';
import {
  getTransporterDialogue as getTransporterDialogueFromContent,
  getVaultByThemeSync,
} from '@/utils/contentLoader';
import DialogueBox from './DialogueBox';
import BookDetail from './BookDetail';
import InteractionPrompt from './InteractionPrompt';
import DebugPanel from './DebugPanel';
import LaunchGate from './LaunchGate';
import MissionPicker from './MissionPicker';

function getTotalFragments(): number {
  try {
    const catalog = getBookCatalogSync();
    return catalog.reduce((n, b) => n + b.fragments.length, 0);
  } catch {
    return 0;
  }
}

function handleHudSummaryAction(): void {
  const state = useGameStore.getState();
  const { booksRemainingOnThisMap, exploredTiles, explorableTileCount } = state.session;
  const fragmentCount = state.library.length;

  const discoveryPercent =
    explorableTileCount > 0
      ? Math.round((exploredTiles.length / explorableTileCount) * 100)
      : 0;

  const parts: string[] = [];

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
  const launchGateOpen = useGameStore((state) => state.session.launchGateOpen);
  const motionPreference = useGameStore((state) => state.settings.motionPreference);
  const gamePhase = useGameStore((state) => state.session.gamePhase);
  const modalOpen = gamePhase === 'mission-select' || gamePhase === 'dialogue' || gamePhase === 'reading' || gamePhase === 'viewing-map';

  useEffect(() => {
    window.addEventListener('keydown', handleKeyboardInput);
    return () => window.removeEventListener('keydown', handleKeyboardInput);
  }, []);

  useEffect(() => {
    const onInputAction = ({ action }: { action: GameInputAction }) => {
      if (action === 'hudSummary') {
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
      try {
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
          if (useGameStore.getState().session.vaultOpened) {
            lines = npc.postVault;
          // Martha: contextual hint based on actual rooms with books this map
          } else if (npc.id === 'martha') {
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
        const state = useGameStore.getState();
        const vaultInfo = state.session.vaultInfo;
        // Clues are namespaced to this generated vault and never persisted.
        if (vaultInfo && id === vaultInfo.clueId) {
          const vault = state.session.activeThemeId
            ? getVaultByThemeSync(state.session.activeThemeId)
            : undefined;
          if (!vault || vault.id !== vaultInfo.contentId || vault.clue.id !== vaultInfo.clueContentId) {
            unlockInteractions();
            return;
          }
          state.actions.discoverVaultClue(vaultInfo.clueId);
          state.actions.openDialogue(vault.clue.lines.map((line) => ({
            text: line.text.replaceAll('{code}', vaultInfo.code.split('').join('-')),
            voiceLineId: line.voiceLineId,
          })));
          setTimeout(() => {
            EventBridge.emit('interactive-consumed', { type: 'journal', id });
          }, 100);
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
        const vault = state.session.activeThemeId
          ? getVaultByThemeSync(state.session.activeThemeId)
          : undefined;
        const hasReadHint = vaultInfo
          ? state.actions.hasDiscoveredVaultClue(vaultInfo.clueId)
          : false;
        const vaultOpened = state.session.vaultOpened;
        
        if (!vaultInfo || !vault || vaultInfo.vaultId !== id || vault.id !== vaultInfo.contentId) {
          unlockInteractions();
        } else if (vaultOpened) {
          const openedLines = vault.dialogue.opened.map((line) => ({ text: line.text }));
          const pendingFragmentId = vaultInfo.reward.kind === 'fragment'
            && !state.savedFragmentIds.includes(vaultInfo.reward.fragmentId)
            ? vaultInfo.reward.fragmentId
            : null;
          if (pendingFragmentId) {
            const pendingFragment = await getFragmentById(pendingFragmentId);
            const pendingBook = pendingFragment
              ? getBookCatalogSync().find((item) => item.id === pendingFragment.bookId)
              : undefined;
            state.actions.openDialogue([
              ...openedLines,
              {
                text: `The recovered ${pendingBook?.title ?? 'excerpt'} is still waiting inside.`,
                choices: [{
                  label: 'Read recovered excerpt',
                  key: 'r',
                  action: `vault-reward-fragment:${pendingFragmentId}`,
                }],
              },
            ]);
          } else {
            state.actions.openDialogue(openedLines);
          }
        } else if (hasReadHint) {
          const formattedCode = vaultInfo.code.split('').join('-');
          state.actions.openVault();
          EventBridge.emit('vault-opened', { vaultId: vaultInfo.vaultId });
          const opening = vault.dialogue.opening.map((line) => ({
            text: line.text.replaceAll('{code}', formattedCode),
          }));

          if (vaultInfo.reward.kind === 'fragment') {
            const fragment = await getFragmentById(vaultInfo.reward.fragmentId);
            if (!fragment) {
              state.actions.openDialogue(opening);
              return;
            }
            const book = getBookCatalogSync().find((item) => item.id === fragment.bookId);
            state.actions.openDialogue([
              ...opening,
              {
                text: `Inside is ${book?.title ?? 'a recovered text'}: ${fragment.label}.`,
                choices: [{
                  label: 'Read recovered excerpt',
                  key: 'r',
                  action: `vault-reward-fragment:${fragment.id}`,
                }],
              },
            ]);
          } else {
            state.actions.readJournal(
              vaultInfo.reward.loreJournalId ?? `lore-${vaultInfo.contentId}`,
            );
            state.actions.openDialogue([
              ...opening,
              { text: vault.exhaustedReward.journalText },
            ]);
          }
        } else {
          state.actions.openDialogue(vault.dialogue.locked.map((line) => ({ text: line.text })));
        }
      } else {
        const lines = getDialogueForInteraction(type, id);
        if (lines.length > 0) {
          useGameStore.getState().actions.openDialogue(lines);
        } else {
          unlockInteractions();
        }
      }
      } catch (error) {
        console.error('Failed to handle interaction', error);
        unlockInteractions();
      }
    };
    EventBridge.on('interaction-triggered', onInteractionTriggered);
    return () => {
      EventBridge.off('interaction-triggered', onInteractionTriggered);
    };
  }, []);

  // Handle dialogue choices (for transporter confirmation)
  useEffect(() => {
    const onDialogueChoice = async ({ action }: { action: string }) => {
      if (action === 'beam-up') {
        EventBridge.emit('beam-up-confirmed');
      } else if (action.startsWith('vault-reward-fragment:')) {
        const fragmentId = action.slice('vault-reward-fragment:'.length);
        const fragment = await getFragmentById(fragmentId);
        if (fragment) {
          useGameStore.getState().actions.collectFragment(fragment);
          EventBridge.emit('book-found', { fragmentId, bookId: fragment.bookId });
        }
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
      const welcomeLines = gameloop.welcome.lines.map(line => ({
        text: line.text,
        voiceLineId: line.voiceLineId,
      }));
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
    <div className="game-container" data-motion={motionPreference}>
      <div
        id="game-controls"
        className="game-shell"
        tabIndex={launchGateOpen ? -1 : 0}
        aria-label="Game controls. Use arrow keys or W A S D to move, E to interact, M for the map, and I for status."
        inert={launchGateOpen}
      >
        <div className="game-world" inert={modalOpen} aria-hidden={modalOpen || undefined}>
          <PhaserGame />
          <HUD />
          <AccessibleLog />
          <LibraryShelf />
          <InteractionPrompt />
          <DebugPanel />
        </div>
        <MissionPicker />
        <MapOverlay />
        <DialogueBox />
        <BookDetail />
      </div>
      <LaunchGate />
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
