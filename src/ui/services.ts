import { createContext, useContext } from 'react';
import type { MountRenderer } from '../game/renderer.ts';
import type { SaveRepository } from '../persistence/saveRepository.ts';

/** Everything the UI needs from the outside world, injected by the composition root (main.tsx). */
export interface AppServices {
  repository: SaveRepository | null;
  mountRenderer: MountRenderer;
  debug: boolean;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesContext missing');
  return services;
}
