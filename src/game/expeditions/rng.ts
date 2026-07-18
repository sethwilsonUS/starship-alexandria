import { RNG as RotRng } from 'rot-js';

const UINT32_RANGE = 0x1_0000_0000;
const NON_ZERO_SEED = 0x6d2b79f5;

/** Stable FNV-1a hash; deliberately independent from JS engine hash behavior. */
export function hashSeed(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || NON_ZERO_SEED;
}
/** Small deterministic PRNG used for every non-ROT generation decision. */
export class SeededRandom {
  private state: number;

  constructor(seed: string | number) {
    this.state = typeof seed === 'number' ? (seed >>> 0) || NON_ZERO_SEED : hashSeed(seed);
  }

  next(): number {
    this.state = (this.state + NON_ZERO_SEED) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  uint32(): number {
    return Math.floor(this.next() * UINT32_RANGE) >>> 0;
  }

  int(minimum: number, maximum: number): number {
    const low = Math.ceil(Math.min(minimum, maximum));
    const high = Math.floor(Math.max(minimum, maximum));
    return low + Math.floor(this.next() * (high - low + 1));
  }

  chance(probability: number): boolean {
    return this.next() < Math.max(0, Math.min(1, probability));
  }

  pick<T>(values: readonly T[]): T | null {
    if (values.length === 0) return null;
    return values[this.int(0, values.length - 1)] ?? null;
  }

  shuffle<T>(values: readonly T[]): T[] {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swapIndex = this.int(0, index);
      [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
  }
}

/**
 * rot-js map builders use a singleton RNG. This adapter makes their use deterministic
 * without leaking seed or sequence changes into another caller.
 */
export function withRotSeed<T>(seed: number, operation: () => T): T {
  const previousSeed = RotRng.getSeed();
  const previousState = RotRng.getState();
  try {
    RotRng.setSeed(seed || NON_ZERO_SEED);
    return operation();
  } finally {
    RotRng.setSeed(previousSeed);
    RotRng.setState(previousState);
  }
}
