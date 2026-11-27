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
  private readonly clouds: Phaser.GameObjects.Image[] = [];
  private readonly flutter: {
    img: Phaser.GameObjects.Image;
    hx: number;
    hy: number;
    phase: number;
    night: boolean;
  }[] = [];
  private readonly meadows: { x: number; y: number }[] = [];

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
    // Meadows where butterflies by day and fireflies by night gather (grass and forest edges).
    for (let y = 2; y < template.height - 2; y += 2) {
      for (let x = 2; x < template.width - 2; x += 2) {
        const code = terrainAt(template, x, y);
        if (code === 'g' || code === 'f') this.meadows.push({ x, y });
      }
    }
    for (let i = 0; i < 26 && this.meadows.length > 0; i++) {
      const m = this.meadows[(i * 37) % this.meadows.length]!;
      const p = cellToWorld(m.x, m.y);
      const night = i % 2 === 1;
      const img = scene.add
        .image(p.x, p.y - 30, night ? 'firefly' : 'butterfly')
        .setDepth(180000)
        .setAlpha(0);
      if (night) img.setBlendMode(Phaser.BlendModes.ADD);
      else img.setTint([0xf4f1e6, 0xf0cc3e, 0xb27cd0, 0xe8a87c][i % 4]!);
      this.flutter.push({ img, hx: p.x, hy: p.y - 30, phase: i * 1.7, night });
    }
    // Slow cloud shadows drifting over the valley: the whole town breathes with the weather.
    for (let i = 0; i < 4; i++) {
      const cloud = scene.add
        .image(0, 0, 'cloud_shadow')
        .setDepth(190000)
        .setAlpha(0.22)
        .setScale(4 + (i % 3), 2.6 + (i % 2));
      const p = cellToWorld(i * 13, (i * 29) % 64);
      cloud.setPosition(p.x - 1500 + i * 900, p.y);
      this.clouds.push(cloud);
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
    if (!tex.exists('cloud_shadow')) {
      const canvas = tex.createCanvas('cloud_shadow', 256, 128)!;
      const ctx = canvas.getContext();
      for (const [x, y, r] of [
        [128, 64, 60],
        [80, 70, 44],
        [176, 60, 48],
        [120, 44, 40],
      ] as const) {
        const grad = ctx.createRadialGradient(x, y, 4, x, y, r);
        grad.addColorStop(0, 'rgba(10,14,20,0.55)');
        grad.addColorStop(1, 'rgba(10,14,20,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 256, 128);
      }
      canvas.refresh();
    }
    if (!tex.exists('butterfly')) {
      const g = this.scene.make.graphics({}, false);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(3, 4, 6, 7);
      g.fillEllipse(9, 4, 6, 7);
      g.fillStyle(0x2a2a2a, 1).fillRect(5.5, 1, 1, 7);
      g.generateTexture('butterfly', 12, 9);
      g.destroy();
    }
    if (!tex.exists('firefly')) {
      const canvas = tex.createCanvas('firefly', 16, 16)!;
      const ctx = canvas.getContext();
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(230,255,150,1)');
      grad.addColorStop(0.3, 'rgba(200,240,90,0.6)');
      grad.addColorStop(1, 'rgba(200,240,90,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 16, 16);
      canvas.refresh();
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
    // Cloud shadows drift with the wind and wrap around; they fade out at night.
    for (const c of this.clouds) {
      c.x += 14 * dt;
      c.y += 4 * dt;
      if (c.x - c.displayWidth / 2 > 4200) c.x = -4200;
      if (c.y > 3600) c.y = -200;
      c.setAlpha(0.16 * (1 - night));
    }
    // Butterflies flutter around their meadow by day; fireflies blink there at night.
    for (const f of this.flutter) {
      f.phase += dt * (f.night ? 0.8 : 1.6);
      const active = f.night ? night : 1 - night;
      const x = f.hx + Math.sin(f.phase * 0.9) * 46 + Math.sin(f.phase * 2.3) * 12;
      const y = f.hy + Math.cos(f.phase * 0.7) * 22 + Math.sin(f.phase * 3.1) * 8;
      f.img.setPosition(x, y);
      if (f.night) {
        f.img.setAlpha(active * (0.4 + 0.6 * Math.max(0, Math.sin(f.phase * 5))));
      } else {
        f.img.setAlpha(active * 0.95).setScale(1, 0.35 + 0.65 * Math.abs(Math.sin(f.phase * 22)));
      }
    }
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
