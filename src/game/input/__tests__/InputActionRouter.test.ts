import { describe, expect, it } from 'vitest';
import { InputActionRouter, MOVE_KEYS, type InputActionContext } from '../InputActionRouter';
import { TransitionGuard } from '../TransitionGuard';

function keyboard(code: string, repeat = false): KeyboardEvent {
  return { code, repeat, preventDefault() {} } as KeyboardEvent;
}

function keyboardWithKey(key: string, repeat = false): KeyboardEvent {
  return { code: '', key, repeat, preventDefault() {} } as KeyboardEvent;
}

function context(overrides: Partial<InputActionContext> = {}): InputActionContext {
  return {
    phase: 'exploring',
    hasAreaMap: true,
    utilityOpen: false,
    now: 1000,
    ...overrides,
  };
}

describe('InputActionRouter', () => {
  it('exports the movement key map', () => {
    expect(MOVE_KEYS.ArrowLeft).toBe('move.left');
  });

  it('maps movement keys to movement actions', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('ArrowUp'), context())).toBe('move.up');
    expect(router.actionFromKeyboard(keyboard('KeyW'), context())).toBe('move.up');
    expect(router.actionFromKeyboard(keyboard('ArrowDown'), context())).toBe('move.down');
    expect(router.actionFromKeyboard(keyboard('KeyS'), context())).toBe('move.down');
    expect(router.actionFromKeyboard(keyboard('ArrowLeft'), context())).toBe('move.left');
    expect(router.actionFromKeyboard(keyboard('KeyA'), context())).toBe('move.left');
    expect(router.actionFromKeyboard(keyboard('ArrowRight'), context())).toBe('move.right');
    expect(router.actionFromKeyboard(keyboard('KeyD'), context())).toBe('move.right');
  });

  it('maps interact, map, info, help, settings, and beam-down keys while leaving B unbound', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('Space'), context())).toBe('interact');
    expect(router.actionFromKeyboard(keyboard('KeyE'), context())).toBe('interact');
    expect(router.actionFromKeyboard(keyboard('KeyM'), context())).toBe('openMap');
    expect(router.actionFromKeyboard(keyboard('KeyB'), context())).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyI'), context())).toBe('hudSummary');
    expect(router.actionFromKeyboard(keyboardWithKey('?'), context())).toBe('openHowToPlay');
    expect(router.actionFromKeyboard(keyboardWithKey('?'), context({ phase: 'ship' }))).toBe('openHowToPlay');
    expect(router.actionFromKeyboard(keyboard('KeyO'), context())).toBe('openSettings');
    expect(router.actionFromKeyboard(keyboardWithKey('o'), context({ phase: 'ship' }))).toBe('openSettings');
    expect(router.actionFromKeyboard(keyboard('Enter'), context({ phase: 'ship' }))).toBe('beamDown');
  });

  it('blocks stale non-movement actions during transition cooldown', () => {
    const guard = new TransitionGuard({ cooldownMs: 300 });
    guard.beginTransition(1000);
    const router = new InputActionRouter({ transitionGuard: guard });

    expect(router.actionFromKeyboard(keyboard('Space'), context({ now: 1100 }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('Space'), context({ now: 1300 }))).toBe('interact');
  });

  it('blocks stale movement actions during transition cooldown', () => {
    const guard = new TransitionGuard({ cooldownMs: 300 });
    guard.beginTransition(1000);
    const router = new InputActionRouter({ transitionGuard: guard });

    expect(router.actionFromKeyboard(keyboard('ArrowRight'), context({ now: 1100 }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('ArrowRight'), context({ now: 1300 }))).toBe('move.right');
  });

  it('does not turn repeated Space into repeated interact or beam-down', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('Space', true), context())).toBeNull();
    expect(router.actionFromKeyboard(keyboard('Space', true), context({ phase: 'ship' }))).toBeNull();
  });

  it('ignores repeats for every non-movement command', () => {
    const router = new InputActionRouter();

    for (const code of ['KeyE', 'KeyM', 'KeyI', 'KeyO', 'Slash']) {
      expect(router.actionFromKeyboard(keyboard(code, true), context())).toBeNull();
    }
    expect(router.actionFromKeyboard(keyboard('Escape', true), context({ phase: 'viewing-map' }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('Enter', true), context({ phase: 'dialogue' }))).toBeNull();
  });

  it('ignores repeated movement keys so one physical press creates one turn', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('ArrowRight', true), context())).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyW', true), context())).toBeNull();
  });

  it('blocks expedition-only actions outside exploration', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('KeyM'), context({ phase: 'ship' }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyI'), context({ phase: 'dialogue' }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('Space'), context({ phase: 'viewing-map' }))).toBeNull();
    expect(router.actionFromKeyboard(keyboardWithKey('?'), context({ phase: 'dialogue' }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyO'), context({ phase: 'dialogue' }))).toBeNull();
  });

  it('blocks every gameplay action while a utility overlay is open', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('ArrowUp'), context({ utilityOpen: true }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyE'), context({ utilityOpen: true }))).toBeNull();
    expect(router.actionFromKeyboard(keyboardWithKey('?'), context({ utilityOpen: true }))).toBeNull();
    expect(router.actionFromKeyboard(keyboard('KeyO'), context({ utilityOpen: true }))).toBeNull();
  });

  it('still dispatches map intent when the area map has not been found', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboard('KeyM'), context({ hasAreaMap: false }))).toBe('openMap');
  });

  it('falls back to KeyboardEvent.key for semantic controls', () => {
    const router = new InputActionRouter();

    expect(router.actionFromKeyboard(keyboardWithKey('m'), context())).toBe('openMap');
    expect(router.actionFromKeyboard(keyboardWithKey('Escape'), context({ phase: 'viewing-map' }))).toBe('closeMap');
    expect(router.actionFromKeyboard(keyboardWithKey('Enter'), context({ phase: 'ship' }))).toBe('beamDown');
  });
});
