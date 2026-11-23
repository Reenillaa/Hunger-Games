import { useEffect, useRef, useState } from 'react';
import type { GameSession, GameSpeed } from '../../game/session.ts';
import { DebugPanel } from '../components/DebugPanel.tsx';
import { PhaseSheet } from '../components/PhaseSheet.tsx';
import { SaveDialog } from '../components/SaveDialog.tsx';
import { TopBar } from '../components/TopBar.tsx';
import { useServices } from '../services.ts';
import styles from '../ui.module.css';

interface Props {
  session: GameSession;
  onExit(): void;
  onExport(): void;
  notify(message: string): void;
}

export function GameScreen({ session, onExit, onExport, notify }: Props) {
  const { mountRenderer, debug } = useServices();
  const host = useRef<HTMLDivElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const lastSpeed = useRef<GameSpeed>(1);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    let cancelled = false;
    let handle: { destroy(): void } | null = null;
    void mountRenderer(parent, session).then((h) => {
      if (cancelled) h.destroy();
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, [session, mountRenderer]);

  // Desktop shortcuts: Space toggles pause, 1/2/3 set speed.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (saveOpen || e.target instanceof HTMLInputElement) return;
      const speedByKey: Record<string, GameSpeed> = { Digit1: 1, Digit2: 2, Digit3: 4 };
      if (e.code === 'Space') {
        e.preventDefault();
        const current = session.getSpeed();
        if (current > 0) lastSpeed.current = current;
        session.setSpeed(current > 0 ? 0 : lastSpeed.current);
      } else if (e.code in speedByKey) {
        session.setSpeed(speedByKey[e.code] as GameSpeed);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [session, saveOpen]);

  return (
    <div className={styles.screen}>
      <div ref={host} className={styles.canvasHost} data-testid="game-canvas" />
      <div className={styles.overlay}>
        <TopBar session={session} onSave={() => setSaveOpen(true)} onMenu={onExit} />
        <PhaseSheet session={session} />
        {debug && <DebugPanel session={session} />}
      </div>
      {saveOpen && (
        <SaveDialog
          session={session}
          onClose={() => setSaveOpen(false)}
          onExport={onExport}
          notify={notify}
        />
      )}
    </div>
  );
}
