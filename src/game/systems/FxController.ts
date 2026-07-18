type FxOrigin = {
  x: number;
  y: number;
};

export class FxController {
  private ownedObjects = new Set<Phaser.GameObjects.GameObject>();
  private activeTweens = new Set<Phaser.Tweens.Tween>();
  private activeTimers = new Set<Phaser.Time.TimerEvent>();
  private isDestroyed = false;

  constructor(private readonly scene: Phaser.Scene) {}

  playScreenBeam(color = 0x5cb3ff, duration = 600): void {
    const { width, height } = this.scene.cameras.main;
    const overlay = this.trackObject(this.scene.add.graphics());
    overlay.setDepth(100);
    overlay.setScrollFactor(0);
    overlay.fillStyle(color, 0.3);
    overlay.fillRect(0, 0, width, height);

    const tween = this.scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: (activeTween) => {
        const t = activeTween.getValue() ?? 1;

        overlay.clear();
        overlay.fillStyle(color, 0.3 + t * 0.7);
        overlay.fillRect(0, 0, width, height);
      },
      onComplete: () => {
        this.activeTweens.delete(tween);
        this.destroyObject(overlay);
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

    const particles = Array.from({ length: 20 }, () => ({
      x: origin.x + (Math.random() - 0.5) * 30,
      y: origin.y + Math.random() * 40 - 20,
      speed: 50 + Math.random() * 100,
      alpha: 0.6 + Math.random() * 0.4,
      size: 3 + Math.random() * 2,
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
