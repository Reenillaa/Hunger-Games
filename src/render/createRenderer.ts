import * as Phaser from 'phaser';
import type { PhaseKind } from '../core/index.ts';
import type { GameSession } from '../game/session.ts';
import type { RendererHandle } from '../game/renderer.ts';
import { PALETTE } from './palette.ts';
import { ARENA_SCENE, ArenaScene } from './scenes/ArenaScene.ts';
import { DISTRICT_SCENE, DistrictScene } from './scenes/DistrictScene.ts';
import { PHASE_SCENE, PhaseScene } from './scenes/PhaseScene.ts';

/** Creates the Phaser game inside `parent` and keeps the active scene in sync with the session phase. */
export function mountRenderer(parent: HTMLElement, session: GameSession): RendererHandle {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: PALETTE.coal,
    banner: false,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth || 800,
      height: parent.clientHeight || 600,
    },
    input: { activePointers: 3 },
    maxLights: 16,
    audio: { noAudio: true },
    scene: [new DistrictScene(session), new PhaseScene(), new ArenaScene(session)],
  });

  // Simulation time is real time: use raw timestamps, not Phaser's smoothed/capped delta,
  // so a slow device renders fewer frames but the in-game clock keeps the same pace.
  let last: number | null = null;
  game.events.on(Phaser.Core.Events.STEP, (time: number) => {
    if (last !== null) session.update(Math.min(time - last, 1000));
    last = time;
  });

  let current: PhaseKind | null = null;
  const sync = () => {
    const kind = session.getState().phase.kind;
    if (kind === current) return;
    current = kind;
    const scenes = game.scene;
    // The Criba happens in the district's own plaza.
    if (kind === 'district' || kind === 'selection') {
      if (scenes.isActive(PHASE_SCENE)) scenes.stop(PHASE_SCENE);
      if (scenes.isActive(ARENA_SCENE)) scenes.stop(ARENA_SCENE);
      if (scenes.isSleeping(DISTRICT_SCENE)) scenes.wake(DISTRICT_SCENE);
      else if (!scenes.isActive(DISTRICT_SCENE)) scenes.start(DISTRICT_SCENE);
    } else if (kind === 'arena') {
      if (scenes.isActive(DISTRICT_SCENE)) scenes.sleep(DISTRICT_SCENE);
      scenes.stop(PHASE_SCENE);
      scenes.start(ARENA_SCENE);
    } else {
      if (scenes.isActive(DISTRICT_SCENE)) scenes.sleep(DISTRICT_SCENE);
      scenes.stop(ARENA_SCENE);
      scenes.stop(PHASE_SCENE);
      scenes.start(PHASE_SCENE, { kind });
    }
  };

  const start = () => {
    // Scenes listed in config autostart the first one; normalise to the session phase.
    current = null;
    if (session.getState().phase.kind !== 'district') game.scene.stop(DISTRICT_SCENE);
    sync();
  };
  if (game.isBooted) start();
  else game.events.once(Phaser.Core.Events.READY, start);

  const offPhase = session.events.on('phase/changed', sync);

  return {
    destroy() {
      offPhase();
      game.destroy(true);
    },
  };
}
