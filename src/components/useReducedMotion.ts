'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';

/** Resolves the persisted system/reduce/full preference for DOM behavior. */
export function useReducedMotion(): boolean {
  const preference = useGameStore((state) => state.settings.motionPreference);
  const [systemReduced, setSystemReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return preference === 'reduce' || (preference === 'system' && systemReduced);
}
