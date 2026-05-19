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
  | 'useBattery'
  | 'hudSummary';

export interface InputActionContext {
  phase: GamePhase;
  hasAreaMap: boolean;
  isGameComplete: boolean;
  now: number;
}

export interface InputActionRouterOptions {
  transitionGuard?: TransitionGuard;
}

const MOVE_KEYS: Record<string, `move.${Direction}`> = {
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
    event: Pick<KeyboardEvent, 'code' | 'repeat'>,
    context: InputActionContext
  ): GameInputAction | null {
    const moveAction = MOVE_KEYS[event.code];
    if (moveAction) {
      return context.phase === 'exploring' ? moveAction : null;
    }

    if (event.repeat) return null;
    if (this.transitionGuard && !this.transitionGuard.canAcceptAction(context.now)) return null;

    if (context.phase === 'dialogue') {
      if (event.code === 'Space' || event.code === 'Enter') return 'advanceDialogue';
      return null;
    }

    if (context.phase === 'reading') return null;

    if (context.phase === 'viewing-map') {
      if (event.code === 'Escape' || event.code === 'KeyM') return 'closeMap';
      return null;
    }

    if (context.phase === 'ship') {
      if ((event.code === 'Space' || event.code === 'Enter') && !context.isGameComplete) {
        return 'beamDown';
      }
      return null;
    }

    if (context.phase === 'exploring') {
      if (event.code === 'Space' || event.code === 'KeyE') return 'interact';
      if (event.code === 'KeyM') return 'openMap';
      if (event.code === 'KeyB') return 'useBattery';
      if (event.code === 'KeyI') return 'hudSummary';
    }

    return null;
  }
}
