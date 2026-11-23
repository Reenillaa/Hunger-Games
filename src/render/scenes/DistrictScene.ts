import * as Phaser from 'phaser';
import type { GameSession } from '../../game/session.ts';
import { CameraController } from '../camera/cameraController.ts';
import { TILE_H, TILE_W, cellToWorld, mapBounds, pickCell } from '../iso/projection.ts';
import { PALETTE } from '../palette.ts';

export const DISTRICT_SCENE = 'district';
const MAP_SIZE = 48;

/**
 * Phase 1 placeholder of the district: a neutral isometric grid that proves projection,
 * camera and picking. Real terrain and buildings arrive in Phase 2 (PLACEHOLDER, not final art).
 */
export class DistrictScene extends Phaser.Scene {
  private controller?: CameraController;
  private hover?: Phaser.GameObjects.Graphics;

  private readonly session: GameSession;

  constructor(session: GameSession) {
    super(DISTRICT_SCENE);
    this.session = session;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(PALETTE.coal);
    const grid = this.add.graphics();
    for (let cx = 0; cx < MAP_SIZE; cx++) {
      for (let cy = 0; cy < MAP_SIZE; cy++) {
        const { x, y } = cellToWorld(cx, cy);
        const shade = (cx + cy) % 2 === 0 ? PALETTE.soot : 0x323136;
        grid.fillStyle(shade, 1);
        grid.lineStyle(1, PALETTE.wetStone, 0.35);
        const pts = diamond(x, y);
        grid.fillPoints(pts, true);
        grid.strokePoints(pts, true);
      }
    }

    this.hover = this.add.graphics().setDepth(10);
    const bounds = mapBounds(MAP_SIZE, MAP_SIZE);
    const pad = 256;
    this.controller = new CameraController(this, {
      minZoom: 0.35,
      maxZoom: 2,
      bounds: {
        x: bounds.x - pad,
        y: bounds.y - pad,
        width: bounds.width + pad * 2,
        height: bounds.height + pad * 2,
      },
    });
    this.cameras.main.setZoom(0.6);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.drawHover(p));
  }

  override update(_time: number, delta: number): void {
    this.controller?.update(delta);
    // Night falls visually with the in-game hour (placeholder for Phase 2 lighting).
    const hour = this.session.getState().clock.tick % 24;
    const night = hour < 6 || hour >= 20 ? 0.45 : hour < 8 || hour >= 18 ? 0.2 : 0;
    this.cameras.main.setAlpha(1 - night * 0.6);
  }

  private drawHover(pointer: Phaser.Input.Pointer): void {
    if (!this.hover) return;
    this.hover.clear();
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const { cx, cy } = pickCell(world.x, world.y);
    if (cx < 0 || cy < 0 || cx >= MAP_SIZE || cy >= MAP_SIZE) return;
    const { x, y } = cellToWorld(cx, cy);
    this.hover.lineStyle(2, PALETTE.lampOchre, 0.9);
    this.hover.strokePoints(diamond(x, y), true);
  }
}

function diamond(x: number, y: number): Phaser.Math.Vector2[] {
  return [
    new Phaser.Math.Vector2(x, y - TILE_H / 2),
    new Phaser.Math.Vector2(x + TILE_W / 2, y),
    new Phaser.Math.Vector2(x, y + TILE_H / 2),
    new Phaser.Math.Vector2(x - TILE_W / 2, y),
  ];
}
