import type { Direction } from '@/types/game';
import type { GamePhase } from '@/types/store';
import type { TransitionGuard } from './TransitionGuard';

export type GameInputAction =
  | `move.${Direction}`
  | 'interact'
  | 'openMap'
  | 'closeMap'
  | 'advanceDialogue'
  | 'beamDown'
  | 'hudSummary'
  | 'openHowToPlay';

export interface InputActionContext {
  phase: GamePhase;
  hasAreaMap: boolean;
  utilityOpen: boolean;
  now: number;
}

export interface InputActionRouterOptions {
  transitionGuard?: TransitionGuard;
}

export const MOVE_KEYS: Record<string, `move.${Direction}`> = {
  ArrowUp: 'move.up',
  KeyW: 'move.up',
  ArrowDown: 'move.down',
  KeyS: 'move.down',
  ArrowLeft: 'move.left',
  KeyA: 'move.left',
  ArrowRight: 'move.right',
  KeyD: 'move.right',
};

export class InputActionRouter {
  private readonly transitionGuard?: TransitionGuard;

  constructor(options: InputActionRouterOptions = {}) {
    this.transitionGuard = options.transitionGuard;
  }

  actionFromKeyboard(
    event: Pick<KeyboardEvent, 'code' | 'repeat'> & Partial<Pick<KeyboardEvent, 'key'>>,
    context: InputActionContext
  ): GameInputAction | null {
    if (this.transitionGuard && !this.transitionGuard.canAcceptAction(context.now)) return null;
    if (event.repeat) return null;
    if (context.utilityOpen) return null;

    if (
      (context.phase === 'ship' || context.phase === 'exploring')
      && isKeyboardMatch(event, 'Slash', '?')
    ) {
      return 'openHowToPlay';
    }

    const moveAction = MOVE_KEYS[event.code];
    if (moveAction) {
      return context.phase === 'exploring' ? moveAction : null;
    }

    if (context.phase === 'dialogue') {
      if (isKeyboardMatch(event, 'Space', ' ') || isKeyboardMatch(event, 'Enter', 'enter')) {
        return 'advanceDialogue';
      }
      return null;
    }

    if (context.phase === 'reading') return null;

    if (context.phase === 'viewing-map') {
      // Map overlay navigation stays in React; this router only closes it today.
      if (isKeyboardMatch(event, 'Escape', 'escape', 'esc') || isKeyboardMatch(event, 'KeyM', 'm', 'keym')) {
        return 'closeMap';
      }
      return null;
    }

    if (context.phase === 'ship') {
      if (
        isKeyboardMatch(event, 'Space', ' ') || isKeyboardMatch(event, 'Enter', 'enter')
      ) {
        return 'beamDown';
      }
      return null;
    }

    if (context.phase === 'exploring') {
      if (isKeyboardMatch(event, 'Space', ' ') || isKeyboardMatch(event, 'KeyE', 'e', 'keye')) {
        return 'interact';
      }
      // openMap is an intent request; the dispatcher handles the "map not found" dialogue.
      if (isKeyboardMatch(event, 'KeyM', 'm', 'keym')) return 'openMap';
      if (isKeyboardMatch(event, 'KeyI', 'i', 'keyi')) return 'hudSummary';
    }

    return null;
  }
}

function isKeyboardMatch(
  event: Pick<KeyboardEvent, 'code'> & Partial<Pick<KeyboardEvent, 'key'>>,
  code: string,
  ...keys: string[]
): boolean {
  if (event.code === code) return true;

  const key = event.key?.toLowerCase();
  return Boolean(key && keys.includes(key));
}
