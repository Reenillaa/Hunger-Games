import * as Phaser from 'phaser';
import type { DistrictTemplate } from '../../core/index.ts';
import { terrainAt } from '../../core/index.ts';
import { cellToWorld } from '../iso/projection.ts';

/**
 * Small living details that are not simulation: crows crossing the valley, coal dust drifting
 * near the mine, glints on the river. Everything scales with the game speed and pauses with it.
 */
export class Ambience {
  private readonly scene: Phaser.Scene;
  private readonly crows: {
    img: Phaser.GameObjects.Image;
    vx: number;
    vy: number;
    phase: number;
  }[] = [];
  private readonly glints: Phaser.GameObjects.Image[] = [];
  private readonly dust: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private crowTimer = 4;

  constructor(
    scene: Phaser.Scene,
    template: DistrictTemplate,
    mineCells: { x: number; y: number }[],
  ) {
    this.scene = scene;
    this.makeTextures();
    // Glints along the river.
    for (let y = 0; y < template.height; y++) {
      for (let x = 0; x < template.width; x++) {
        if (terrainAt(template, x, y) !== 'w' || (x * 7 + y * 3) % 3 !== 0) continue;
        const p = cellToWorld(x + ((x * 13) % 7) / 10 - 0.3, y + ((y * 11) % 7) / 10 - 0.3, -0.12);
        const glint = scene.add
          .image(p.x, p.y, 'glint')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(-4800)
          .setAlpha(0);
        glint.setData('phase', (x * 0.7 + y * 1.3) % (Math.PI * 2));
        this.glints.push(glint);
      }
    }
    // Coal dust around the mine heads.
    for (const c of mineCells) {
      const p = cellToWorld(c.x, c.y);
      const emitter = scene.add.particles(p.x, p.y - 20, 'mote', {
        lifespan: 6000,
        speedX: { min: -8, max: 8 },
        speedY: { min: -6, max: 2 },
        scale: { start: 0.6, end: 1.2 },
        alpha: { start: 0.35, end: 0 },
        frequency: 220,
        emitZone: { type: 'random', source: new Phaser.Geom.Ellipse(0, 0, 220, 110) } as never,
        tint: 0x2a2a2a,
      });
      emitter.setDepth(9000);
      this.dust.push(emitter);
    }
  }

  private makeTextures(): void {
    const tex = this.scene.textures;
    if (!tex.exists('glint')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xcfe3ea, 0.9).fillEllipse(8, 2, 14, 2.5);
      g.generateTexture('glint', 16, 4);
      g.destroy();
    }
    if (!tex.exists('mote')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1).fillCircle(2, 2, 2);
      g.generateTexture('mote', 4, 4);
      g.destroy();
    }
    if (!tex.exists('crow')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0x121214, 1);
      g.fillTriangle(0, 3, 9, 6, 9, 8);
      g.fillTriangle(18, 3, 9, 6, 9, 8);
      g.fillEllipse(9, 7, 4, 3);
      g.generateTexture('crow', 18, 10);
      g.destroy();
    }
  }

  private spawnFlock(): void {
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? view.x - 60 : view.right + 60;
    const startY = view.y + view.height * (0.15 + Math.random() * 0.4);
    const vx = (fromLeft ? 1 : -1) * (70 + Math.random() * 40);
    const vy = -10 + Math.random() * 20;
    const count = 3 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const img = this.scene.add
        .image(startX - Math.sign(vx) * i * 26, startY + (i % 2) * 14 + i * 4, 'crow')
        .setDepth(200000)
        .setScale(0.9 + Math.random() * 0.4);
      this.crows.push({ img, vx, vy, phase: Math.random() * Math.PI * 2 });
    }
  }

  update(deltaMs: number, speed: number, night: number, timeMs: number): void {
    const dt = (deltaMs / 1000) * Math.max(speed, 0);
    for (const d of this.dust) d.timeScale = speed;
    for (const g of this.glints) {
      const phase = g.getData('phase') as number;
      g.setAlpha((0.25 + 0.35 * Math.max(0, Math.sin(timeMs / 900 + phase))) * (1 - night * 0.7));
    }
    if (speed > 0 && night < 0.6) {
      this.crowTimer -= dt;
      if (this.crowTimer <= 0) {
        this.spawnFlock();
        this.crowTimer = 25 + Math.random() * 35;
      }
    }
    const view = this.scene.cameras.main.worldView;
    for (let i = this.crows.length - 1; i >= 0; i--) {
      const c = this.crows[i]!;
      c.phase += dt * 9;
      c.img.x += c.vx * dt;
      c.img.y += c.vy * dt + Math.sin(c.phase * 0.3) * 0.2;
      c.img.setScale(
        c.img.scaleX,
        Math.abs(c.img.scaleX) * (0.55 + 0.45 * Math.abs(Math.sin(c.phase))),
      );
      if (c.img.x < view.x - 200 || c.img.x > view.right + 200) {
        c.img.destroy();
        this.crows.splice(i, 1);
      }
    }
  }
}
