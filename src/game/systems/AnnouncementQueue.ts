export interface CancellableDelay {
  cancel: () => void;
}

export interface AnnouncementScheduler {
  delay: (ms: number, callback: () => void) => CancellableDelay;
}

export interface AnnouncementStep {
  delayMs: number;
  run: () => void;
}

export function createSceneAnnouncementScheduler(scene: Phaser.Scene): AnnouncementScheduler {
  return {
    delay: (ms, callback) => {
      const event = scene.time.delayedCall(ms, callback);
      return {
        cancel: () => event.remove(false),
      };
    },
  };
}

export class AnnouncementQueue {
  private activeDelay: CancellableDelay | null = null;
  private sequenceToken = 0;

  constructor(private readonly scheduler: AnnouncementScheduler) {}

  play(steps: AnnouncementStep[], onComplete?: () => void): void {
    this.cancel();
    const token = ++this.sequenceToken;
    this.playStep(token, steps, 0, onComplete);
  }

  cancel(): void {
    this.sequenceToken += 1;
    this.activeDelay?.cancel();
    this.activeDelay = null;
  }

  destroy(): void {
    this.cancel();
  }

  private playStep(
    token: number,
    steps: AnnouncementStep[],
    index: number,
    onComplete?: () => void
  ): void {
    if (token !== this.sequenceToken) return;

    const step = steps[index];
    if (!step) {
      onComplete?.();
      return;
    }

    let delay: CancellableDelay | null = null;
    delay = this.scheduler.delay(step.delayMs, () => {
      if (this.activeDelay === delay) {
        this.activeDelay = null;
      }
      if (token !== this.sequenceToken) return;
      step.run();
      this.playStep(token, steps, index + 1, onComplete);
    });
    this.activeDelay = delay;
  }
}
