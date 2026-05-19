export interface TransitionGuardOptions {
  cooldownMs?: number;
}

export class TransitionGuard {
  private readonly cooldownMs: number;
  private epoch = 0;
  private blockedUntil = 0;

  constructor(options: TransitionGuardOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? 350;
  }

  beginTransition(now = Date.now(), cooldownMs = this.cooldownMs): number {
    this.epoch += 1;
    this.blockedUntil = now + cooldownMs;
    return this.epoch;
  }

  release(now = Date.now()): void {
    this.blockedUntil = now;
  }

  canAcceptAction(now = Date.now()): boolean {
    return now >= this.blockedUntil;
  }

  getEpoch(): number {
    return this.epoch;
  }

  isCurrentEpoch(epoch: number): boolean {
    return this.epoch === epoch;
  }
}
