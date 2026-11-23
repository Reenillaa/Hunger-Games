/**
 * Art pipeline spike viewer (TASKS F1-11): pre-rendered sprites + normal maps lit in real time by
 * Phaser 4. `?light=left|right|orbit` positions the warm lamp light; `?ambient=day|night`.
 */
import * as Phaser from 'phaser';
import { TILE_H, TILE_W, cellToWorld } from '../../../src/render/iso/projection.ts';

const params = new URLSearchParams(location.search);
const DIRS = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'] as const;
const SCALE = 2; // sprites are rendered at 2x

interface Meta {
  anchor: [number, number];
  size: [number, number];
}

class SpikeScene extends Phaser.Scene {
  private lamp?: Phaser.GameObjects.Light;

  preload(): void {
    this.load.image('house', ['house_miner.png', 'house_miner_n.png']);
    for (const d of DIRS) this.load.image(`miner_${d}`, [`miner_${d}.png`, `miner_${d}_n.png`]);
    this.load.json('houseMeta', 'house_miner.json');
    this.load.json('minerMeta', 'miner.json');
  }

  create(): void {
    const night = params.get('ambient') === 'night';
    this.lights.enable().setAmbientColor(night ? 0x2a3040 : 0x8a8a90);
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2 - 40;
    const at = (x: number, y: number) => {
      const p = cellToWorld(x, y);
      return { x: cx + p.x * SCALE, y: cy + p.y * SCALE };
    };

    // Placeholder ground (2x tile size), also lit.
    const ground = this.add.graphics().setLighting(true);
    for (let x = -3; x <= 4; x++) {
      for (let y = -3; y <= 4; y++) {
        const c = at(x, y);
        const w = (TILE_W * SCALE) / 2;
        const h = (TILE_H * SCALE) / 2;
        ground.fillStyle((x + y) % 2 === 0 ? 0x3b3a3c : 0x353437, 1);
        ground.fillPoints(
          [
            new Phaser.Math.Vector2(c.x, c.y - h),
            new Phaser.Math.Vector2(c.x + w, c.y),
            new Phaser.Math.Vector2(c.x, c.y + h),
            new Phaser.Math.Vector2(c.x - w, c.y),
          ],
          true,
        );
      }
    }

    // House on a 2x2 footprint: its origin sits on the shared corner of the 4 cells.
    const houseMeta = this.cache.json.get('houseMeta') as Meta;
    const hp = at(0.5, 0.5);
    this.add
      .image(hp.x, hp.y, 'house')
      .setOrigin(houseMeta.anchor[0] / houseMeta.size[0], houseMeta.anchor[1] / houseMeta.size[1])
      .setDepth(hp.y)
      .setLighting(true);

    // The eight facing directions in front of the house.
    const minerMeta = this.cache.json.get('minerMeta') as (Meta & { name: string })[];
    DIRS.forEach((d, i) => {
      const meta = minerMeta.find((m) => m.name === `miner_${d}`)!;
      const p = at(3 + (i % 4) * 0.0 + Math.floor(i / 4) * 0.9 - 0.4, -1.6 + (i % 4) * 0.95);
      this.add
        .image(p.x, p.y, `miner_${d}`)
        .setOrigin(meta.anchor[0] / meta.size[0], meta.anchor[1] / meta.size[1])
        .setDepth(p.y)
        .setLighting(true);
    });

    const mode = params.get('light') ?? 'orbit';
    const lx = mode === 'left' ? cx - 420 : mode === 'right' ? cx + 420 : cx;
    this.lamp = this.lights.addLight(lx, cy - 60, 900, 0xffb060, night ? 3.2 : 1.6, 220);
    if (mode === 'orbit') {
      this.tweens.addCounter({
        from: 0,
        to: Math.PI * 2,
        duration: 6000,
        repeat: -1,
        onUpdate: (tw) => {
          const a = tw.getValue() ?? 0;
          this.lamp?.setPosition(cx + Math.cos(a) * 420, cy + Math.sin(a) * 200);
        },
      });
    }
  }
}

new Phaser.Game({
  type: Phaser.WEBGL,
  width: 1280,
  height: 760,
  backgroundColor: '#16161a',
  scene: SpikeScene,
  banner: false,
});
