import { useGameStore } from '@/store/gameStore';
import { isNativeInteractiveTarget } from '@/utils/domEvents';
import { EventBridge } from '../EventBridge';
import {
  InputActionRouter,
  type GameInputAction,
  type InputActionContext,
} from './InputActionRouter';
import { TransitionGuard } from './TransitionGuard';

export const transitionGuard = new TransitionGuard({ cooldownMs: 350 });
export const inputActionRouter = new InputActionRouter({ transitionGuard });

export function getInputActionContext(now = Date.now()): InputActionContext {
  const state = useGameStore.getState();

  return {
    phase: state.session.gamePhase,
    hasAreaMap: state.session.hasAreaMap,
    utilityOpen: state.session.activeUtility !== null,
    now,
  };
}

export function dispatchGameInputAction(action: GameInputAction): boolean {
  if (action === 'openSettings') {
    useGameStore.getState().actions.openSettings();
    return true;
  }

  if (action === 'openHowToPlay') {
    useGameStore.getState().actions.openHowToPlay();
    return true;
  }

  if (action === 'beamDown') {
    useGameStore.getState().actions.openMissionPicker();
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
  if (event.defaultPrevented) return false;
  if (isNativeInteractiveTarget(event.target)) return false;
  if (useGameStore.getState().session.launchGateOpen) return false;

  const action = inputActionRouter.actionFromKeyboard(event, getInputActionContext());
  if (!action) return false;

  event.preventDefault();
  return dispatchGameInputAction(action);
}
