import { forwardRef, useLayoutEffect, useRef, type ForwardedRef } from 'react';
import StartGame from '@/game/main';

export interface IRefPhaserGame {
  game: Phaser.Game | null;
  scene: Phaser.Scene | null;
}

export function assignPhaserGameRef(
  ref: ForwardedRef<IRefPhaserGame>,
  value: IRefPhaserGame | null,
): void {
  if (typeof ref === 'function') {
    ref(value);
  } else if (ref) {
    ref.current = value;
  }
}

export function transferPhaserGameRef(
  previousRef: ForwardedRef<IRefPhaserGame>,
  nextRef: ForwardedRef<IRefPhaserGame>,
  game: Phaser.Game | null,
): void {
  if (previousRef === nextRef) return;
  assignPhaserGameRef(previousRef, null);
  if (game) assignPhaserGameRef(nextRef, { game, scene: null });
}

export const PhaserGame = forwardRef<IRefPhaserGame>(function PhaserGame(_, ref) {
  const game = useRef<Phaser.Game | null>(null);
  const latestRef = useRef(ref);

  useLayoutEffect(() => {
    const previousRef = latestRef.current;
    latestRef.current = ref;
    transferPhaserGameRef(previousRef, ref, game.current);
  }, [ref]);

  useLayoutEffect(() => {
    if (game.current === null) {
      game.current = StartGame('game-container');
      assignPhaserGameRef(latestRef.current, { game: game.current, scene: null });
    }

    return () => {
      if (game.current) {
        game.current.destroy(true);
        game.current = null;
      }
      assignPhaserGameRef(latestRef.current, null);
    };
  }, []);

  return <div id="game-container" role="img" aria-label="Starship Alexandria game world" />;
});
