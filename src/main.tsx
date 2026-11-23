import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { MountRenderer } from './game/renderer.ts';
import { SaveRepository } from './persistence/saveRepository.ts';
import { App } from './ui/App.tsx';
import type { AppServices } from './ui/services.ts';
import { ServicesContext } from './ui/services.ts';
import './ui/theme/tokens.css';
import './ui/theme/base.css';

/** Composition root: the only module that wires ui, render and persistence together. */

// The engine bundle is loaded on demand, so the menu is interactive before Phaser downloads.
const mountRenderer: MountRenderer = async (parent, session) => {
  const { mountRenderer: mount } = await import('./render/createRenderer.ts');
  return mount(parent, session);
};

async function boot(): Promise<void> {
  const repository = await SaveRepository.open().catch((error: unknown) => {
    console.warn('Saving disabled:', error);
    return null;
  });
  const services: AppServices = {
    repository,
    mountRenderer,
    debug: new URLSearchParams(window.location.search).has('debug'),
  };
  const root = document.getElementById('root');
  if (!root) throw new Error('#root missing');
  createRoot(root).render(
    <StrictMode>
      <ServicesContext.Provider value={services}>
        <App />
      </ServicesContext.Provider>
    </StrictMode>,
  );
}

void boot();
