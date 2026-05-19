import { getBookCatalogSync } from '@/data/books';
import { useGameStore } from '@/store/gameStore';
import { EventBridge } from '../EventBridge';
import {
  InputActionRouter,
  type GameInputAction,
  type InputActionContext,
} from './InputActionRouter';
import { TransitionGuard } from './TransitionGuard';

export const transitionGuard = new TransitionGuard({ cooldownMs: 350 });
export const inputActionRouter = new InputActionRouter({ transitionGuard });

const NATIVE_INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [contenteditable="true"], [contenteditable=""]';

function isNativeInteractiveTarget(target: EventTarget | null): boolean {
  const closest = (target as { closest?: unknown } | null)?.closest;
  if (typeof closest !== 'function') return false;

  return Boolean(closest.call(target, NATIVE_INTERACTIVE_SELECTOR));
}

export function getInputActionContext(now = Date.now()): InputActionContext {
  const state = useGameStore.getState();
  let totalFragments = 0;

  try {
    totalFragments = getBookCatalogSync().reduce(
      (sum, book) => sum + book.fragments.length,
      0
    );
  } catch {
    totalFragments = 0;
  }

  return {
    phase: state.session.gamePhase,
    hasAreaMap: state.session.hasAreaMap,
    isGameComplete: totalFragments > 0 && state.library.length >= totalFragments,
    now,
  };
}

export function dispatchGameInputAction(action: GameInputAction): boolean {
  if (action === 'beamDown') {
    EventBridge.emit('beam-down-requested');
    return true;
  }

  if (action === 'openMap') {
    const { actions, session } = useGameStore.getState();
    if (!session.hasAreaMap) {
      actions.openDialogue([{ text: "You haven't found the map to this area yet." }]);
    } else {
      actions.openMap();
    }
    return true;
  }

  if (action === 'closeMap') {
    useGameStore.getState().actions.closeMap();
    return true;
  }

  EventBridge.emit('input-action', { action });
  return true;
}

export function handleKeyboardInput(event: KeyboardEvent): boolean {
  if (isNativeInteractiveTarget(event.target)) return false;

  const action = inputActionRouter.actionFromKeyboard(event, getInputActionContext());
  if (!action) return false;

  event.preventDefault();
  return dispatchGameInputAction(action);
}
