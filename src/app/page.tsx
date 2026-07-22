'use client';

import dynamic from 'next/dynamic';

const GameContainer = dynamic(() => import('@/components/GameContainer'), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#game-controls">Skip to game controls</a>
      <main id="main-content" style={{ minHeight: '100vh' }}>
        <GameContainer />
      </main>
    </>
  );
}
