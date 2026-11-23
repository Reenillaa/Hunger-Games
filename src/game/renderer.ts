import type { GameSession } from './session.ts';

/** Contract between the UI shell and the renderer, so ui/ and render/ never import each other. */
export interface RendererHandle {
  destroy(): void;
}

/** Async so the engine bundle can be lazy-loaded after the menu is interactive. */
export type MountRenderer = (parent: HTMLElement, session: GameSession) => Promise<RendererHandle>;
