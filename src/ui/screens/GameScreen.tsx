import { useEffect, useRef, useState } from 'react';
import type { GameSession, GameSpeed } from '../../game/session.ts';
import { BuildMenu } from '../components/BuildMenu.tsx';
import { CapitalPanel } from '../components/CapitalPanel.tsx';
import { CitizenCard } from '../components/CitizenCard.tsx';
import { CinematicOverlay } from '../components/CinematicOverlay.tsx';
import { PopulationPanel } from '../components/PopulationPanel.tsx';
import { DebugPanel } from '../components/DebugPanel.tsx';
import { ResourceBar } from '../components/ResourceBar.tsx';
import { SelectionPanel } from '../components/SelectionPanel.tsx';
import { PhaseSheet } from '../components/PhaseSheet.tsx';
import { ArenaPanel } from '../components/ArenaPanel.tsx';
import { EventDialog } from '../components/EventDialog.tsx';
import { MishapNotice } from '../components/MishapNotice.tsx';
import { ChroniclePanel } from '../components/ChroniclePanel.tsx';
import { LawsPanel } from '../components/LawsPanel.tsx';
import { ObjectivesCard } from '../components/ObjectivesCard.tsx';
import { SettingsDialog } from '../components/SettingsDialog.tsx';
import { AudioDirector } from '../AudioDirector.tsx';
import { useUi } from '../useUi.ts';
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
  const ui = useUi(session);

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
      if (e.key === 'Escape') session.ui.cancel();
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
        <ResourceBar session={session} />
        <ObjectivesCard session={session} />
        <BuildMenu session={session} />
        <SelectionPanel session={session} />
        <PhaseSheet session={session} />
        <CapitalPanel session={session} />
        <ArenaPanel session={session} />
        <EventDialog session={session} />
        <MishapNotice session={session} />
        {debug && <DebugPanel session={session} />}
      </div>
      <CinematicOverlay session={session} />
      <PopulationPanel session={session} />
      <ChroniclePanel session={session} />
      <LawsPanel session={session} />
      {ui.panel === 'settings' && <SettingsDialog onClose={() => session.ui.closePanel()} />}
      <AudioDirector session={session} />
      <CitizenCard session={session} />
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
