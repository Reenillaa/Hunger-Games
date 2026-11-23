import * as Phaser from 'phaser';

export interface CameraControllerOptions {
  minZoom: number;
  maxZoom: number;
  /** World rectangle the camera may show. */
  bounds: { x: number; y: number; width: number; height: number };
}

const DRAG_THRESHOLD_PX = 6;
const KEY_PAN_SPEED = 900; // screen px per second

/**
 * Unified camera input: drag to pan (mouse or one finger), pinch or wheel to zoom
 * around the gesture point, WASD/arrows and +/- on desktop (TECHNICAL_ARCHITECTURE §10).
 */
export class CameraController {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;
  private dragging = false;
  private dragStart = { x: 0, y: 0 };
  private pinchStartDistance = 0;
  private pinchStartZoom = 1;
  private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  /** True if the last pointer gesture was a drag/pinch (so it must not count as a tap). */
  gestureConsumed = false;

  private readonly scene: Phaser.Scene;
  private readonly options: CameraControllerOptions;

  constructor(scene: Phaser.Scene, options: CameraControllerOptions) {
    this.scene = scene;
    this.options = options;
    this.cam = scene.cameras.main;
    const { bounds } = options;
    this.cam.setBounds(bounds.x, bounds.y, bounds.width, bounds.height);
    this.cam.centerOn(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    const input = scene.input;
    input.addPointer(1);
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('wheel', this.onWheel, this);

    const kb = input.keyboard;
    if (kb) {
      this.keys = kb.addKeys(
        'W,A,S,D,UP,DOWN,LEFT,RIGHT,PLUS,MINUS,NUMPAD_ADD,NUMPAD_SUBTRACT',
        false,
      ) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  update(deltaMs: number): void {
    const k = this.keys;
    if (!k.W) return;
    const step = (KEY_PAN_SPEED * deltaMs) / 1000 / this.cam.zoom;
    if (k.W.isDown || k.UP?.isDown) this.cam.scrollY -= step;
    if (k.S?.isDown || k.DOWN?.isDown) this.cam.scrollY += step;
    if (k.A?.isDown || k.LEFT?.isDown) this.cam.scrollX -= step;
    if (k.D?.isDown || k.RIGHT?.isDown) this.cam.scrollX += step;
    const zoomIn = k.PLUS?.isDown || k.NUMPAD_ADD?.isDown;
    const zoomOut = k.MINUS?.isDown || k.NUMPAD_SUBTRACT?.isDown;
    if (zoomIn || zoomOut) {
      const factor = Math.exp(((zoomIn ? 1 : -1) * deltaMs) / 600);
      this.zoomAt(this.cam.zoom * factor, this.cam.width / 2, this.cam.height / 2);
    }
  }

  /** Zooms keeping the world point under (screenX, screenY) fixed. */
  zoomAt(targetZoom: number, screenX: number, screenY: number): void {
    const cam = this.cam;
    const zoom = Phaser.Math.Clamp(targetZoom, this.options.minZoom, this.options.maxZoom);
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    const worldX = cam.scrollX + ox + (screenX - ox) / cam.zoom;
    const worldY = cam.scrollY + oy + (screenY - oy) / cam.zoom;
    cam.setZoom(zoom);
    cam.setScroll(worldX - ox - (screenX - ox) / zoom, worldY - oy - (screenY - oy) / zoom);
  }

  private activeTouches(): Phaser.Input.Pointer[] {
    return this.scene.input.manager.pointers.filter((p) => p.isDown);
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const touches = this.activeTouches();
    if (touches.length >= 2) {
      const [a, b] = touches as [Phaser.Input.Pointer, Phaser.Input.Pointer];
      this.pinchStartDistance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.pinchStartZoom = this.cam.zoom;
      this.dragging = false;
      this.gestureConsumed = true;
      return;
    }
    this.gestureConsumed = false;
    this.dragging = false;
    this.dragStart = { x: pointer.x, y: pointer.y };
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    const touches = this.activeTouches();
    if (touches.length >= 2 && this.pinchStartDistance > 0) {
      const [a, b] = touches as [Phaser.Input.Pointer, Phaser.Input.Pointer];
      const distance = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      this.zoomAt(
        this.pinchStartZoom * (distance / this.pinchStartDistance),
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
      );
      return;
    }
    if (!pointer.isDown) return;
    if (!this.dragging) {
      const moved = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        this.dragStart.x,
        this.dragStart.y,
      );
      if (moved < DRAG_THRESHOLD_PX) return;
      this.dragging = true;
      this.gestureConsumed = true;
    }
    this.cam.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cam.zoom;
    this.cam.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cam.zoom;
  }

  private onUp(): void {
    if (this.activeTouches().length < 2) this.pinchStartDistance = 0;
    if (this.activeTouches().length === 0) this.dragging = false;
  }

  private onWheel(pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    this.zoomAt(this.cam.zoom * Math.exp(-dy * 0.0015), pointer.x, pointer.y);
  }

  destroy(): void {
    const input = this.scene.input;
    input.off('pointerdown', this.onDown, this);
    input.off('pointermove', this.onMove, this);
    input.off('pointerup', this.onUp, this);
    input.off('wheel', this.onWheel, this);
  }
}
