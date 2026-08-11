type FxOrigin = {
  x: number;
  y: number;
};

/** Fixed puff shapes cycled per step keep dust deterministic for identical input sequences. */
const DUST_PUFF_PATTERNS: ReadonlyArray<{ dx: number; dy: number; size: number; drift: number }> = [
  { dx: -4, dy: 9, size: 2.2, drift: -3 },
  { dx: 3, dy: 11, size: 2.8, drift: 4 },
  { dx: 0, dy: 10, size: 1.8, drift: -2 },
  { dx: 5, dy: 9, size: 2.4, drift: 2 },
  { dx: -3, dy: 12, size: 2.0, drift: 3 },
  { dx: 1, dy: 10, size: 3.0, drift: -4 },
];

export class FxController {
  private ownedObjects = new Set<Phaser.GameObjects.GameObject>();
  private activeTweens = new Set<Phaser.Tweens.Tween>();
  private activeTimers = new Set<Phaser.Time.TimerEvent>();
  private isDestroyed = false;
  private dustCycle = 0;

  constructor(private readonly scene: Phaser.Scene) {}

  /** Arrival: the transporter column contracts and sparks lift away as the archivist materializes. */
  playMaterialize(origin: FxOrigin): void {
    const beam = this.trackObject(this.scene.add.graphics());
    beam.setDepth(20);

    const sparks = Array.from({ length: 10 }, (_, index) => ({
      x: origin.x + (((index * 53 + 17) % 33) - 16),
      y: origin.y + (((index * 29 + 7) % 37) - 18),
      speed: 40 + ((index * 31) % 50),
      size: 1.5 + ((index * 13) % 10) / 5,
    }));

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 700,
      ease: 'Sine.easeOut',
      onUpdate: (activeTween) => {
        const t = activeTween.getValue() ?? 1;
        const view = this.scene.cameras.main.worldView;
        const beamWidth = 46 * (1 - t) + 6;

        beam.clear();
        beam.fillStyle(0x9cd6ff, 0.5 * (1 - t));
        beam.fillRect(origin.x - beamWidth / 2, view.y, beamWidth, view.height);
        beam.fillStyle(0xffffff, 0.7 * (1 - t));
        beam.fillRect(origin.x - beamWidth / 6, view.y, beamWidth / 3, view.height);

        sparks.forEach((spark) => {
          beam.fillStyle(0x9cd6ff, 0.8 * (1 - t));
          beam.fillCircle(spark.x, spark.y - spark.speed * t * 0.5, spark.size);
        });
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.destroyObject(beam);
      },
    });
    this.trackTween(tween);
  }

  /** Small fading puffs at the feet when a step lands. */
  playStepDust(origin: FxOrigin, color: number): void {
    const dust = this.trackObject(this.scene.add.graphics());
    dust.setDepth(3.4);

    const puffs = Array.from({ length: 3 }, () => {
      const pattern = DUST_PUFF_PATTERNS[this.dustCycle];
      this.dustCycle = (this.dustCycle + 1) % DUST_PUFF_PATTERNS.length;
      return {
        x: origin.x + pattern.dx,
        y: origin.y + pattern.dy,
        size: pattern.size,
        drift: pattern.drift,
      };
    });

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 260,
      ease: 'Quad.easeOut',
      onUpdate: (activeTween) => {
        const t = activeTween.getValue() ?? 1;
        dust.clear();
        puffs.forEach((puff) => {
          dust.fillStyle(color, 0.26 * (1 - t));
          dust.fillCircle(puff.x + puff.drift * t, puff.y - 5 * t, puff.size * (1 + t * 0.8));
        });
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.destroyObject(dust);
      },
    });
    this.trackTween(tween);
  }

  playPickupBurst(origin: FxOrigin): void {
    this.scene.cameras.main.shake(200, 0.008);

    const { width, height } = this.scene.cameras.main;
    const flash = this.trackObject(this.scene.add.graphics());
    flash.setDepth(200);
    flash.setScrollFactor(0);

    const burst = this.trackObject(this.scene.add.graphics());
    burst.setDepth(201);

    const particles = Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * 80,
        vy: Math.sin(angle) * 80,
        size: 4 + Math.random() * 3,
      };
    });

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      ease: 'Quad.easeOut',
      onUpdate: (activeTween) => {
        const t = activeTween.getValue() ?? 1;

        flash.clear();
        flash.fillStyle(0xd4af37, 0.3 * (1 - t));
        flash.fillRect(0, 0, width, height);

        burst.clear();
        particles.forEach((particle) => {
          const x = particle.x + particle.vx * t * 0.4;
          const y = particle.y + particle.vy * t * 0.4;
          burst.fillStyle(0xd4af37, 1 - t);
          burst.fillCircle(x, y, particle.size * (1 - t * 0.5));
        });
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.destroyObject(flash);
        this.destroyObject(burst);
      },
    });
    this.trackTween(tween);
  }

  playBeamColumn(origin: FxOrigin, onFade: () => void, onComplete: () => void): void {
    const beam = this.trackObject(this.scene.add.graphics());
    beam.setDepth(100);

    // Index-derived scatter keeps the beam identical between runs.
    const particles = Array.from({ length: 20 }, (_, index) => ({
      x: origin.x + (((index * 41 + 13) % 31) - 15),
      y: origin.y + (((index * 23 + 5) % 41) - 20),
      speed: 50 + ((index * 37) % 100),
      alpha: 0.6 + ((index * 17) % 40) / 100,
      size: 3 + ((index * 11) % 20) / 10,
    }));

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 800,
      ease: 'Sine.easeInOut',
      onUpdate: (activeTween) => {
        const t = activeTween.getValue() ?? 1;
        const camera = this.scene.cameras.main;
        const beamWidth = 40 + t * 60;
        const coreWidth = 20 + t * 20;
        const beamTop = camera.scrollY - 50;
        const beamHeight = camera.height + 100;

        beam.clear();
        beam.fillStyle(0x5cb3ff, 0.3 + t * 0.5);
        beam.fillRect(origin.x - beamWidth / 2, beamTop, beamWidth, beamHeight);
        beam.fillStyle(0xffffff, 0.6 + t * 0.4);
        beam.fillRect(origin.x - coreWidth / 2, beamTop, coreWidth, beamHeight);

        particles.forEach((particle) => {
          const y = particle.y - particle.speed * t * 0.8;
          beam.fillStyle(0x5cb3ff, particle.alpha * (1 - t * 0.5));
          beam.fillCircle(particle.x, y, particle.size);
        });
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.destroyObject(beam);
      },
    });
    this.trackTween(tween);

    const fadeTimer = this.scene.time.delayedCall(600, () => {
      this.activeTimers.delete(fadeTimer);
      if (!this.isDestroyed) onFade();
    });
    this.activeTimers.add(fadeTimer);

    const completeTimer = this.scene.time.delayedCall(1000, () => {
      this.activeTimers.delete(completeTimer);
      if (!this.isDestroyed) onComplete();
    });
    this.activeTimers.add(completeTimer);
  }

  destroy(): void {
    this.isDestroyed = true;
    // Counter tweens do not target owned graphics, so stop both target-based and tracked tweens.
    this.scene.tweens.killTweensOf([...this.ownedObjects]);
    this.activeTweens.forEach((tween) => tween.stop());
    this.activeTweens.clear();

    this.activeTimers.forEach((timer) => timer.remove(false));
    this.activeTimers.clear();

    this.ownedObjects.forEach((object) => {
      if (object.active) object.destroy();
    });
    this.ownedObjects.clear();
  }

  private trackObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.ownedObjects.add(object);
    return object;
  }

  private trackTween(tween: Phaser.Tweens.Tween): void {
    this.activeTweens.add(tween);
  }

  private destroyObject(object: Phaser.GameObjects.GameObject): void {
    if (object.active) object.destroy();
    this.ownedObjects.delete(object);
  }
}
