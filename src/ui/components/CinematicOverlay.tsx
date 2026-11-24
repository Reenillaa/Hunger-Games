import { useSyncExternalStore } from 'react';
import { ageOf, fullName } from '../../core/index.ts';
import { t } from '../../content/i18n.ts';
import type { CinematicPlayer, CineView } from '../../game/cinematic.ts';
import type { GameSession } from '../../game/session.ts';
import { useSession } from '../useSession.ts';
import { Portrait } from './Portrait.tsx';
import styles from '../ui.module.css';

const IDLE: CineView = {
  step: null,
  index: 0,
  black: false,
  camera: null,
  focus: null,
  done: true,
};
const noop = () => () => {};

function useCinematic(player: CinematicPlayer | null): CineView {
  return useSyncExternalStore(player ? player.subscribe : noop, player ? player.get : () => IDLE);
}

/** Letterboxed cinematic layer: titles, narration with speaker, name reveal cards, skip. */
export function CinematicOverlay({ session }: { session: GameSession }) {
  const { state } = useSession(session);
  const player = session.cinematic;
  const view = useCinematic(player);
  if (!player || view.done) return null;
  const step = view.step;
  const day = Math.floor(state.clock.tick / 24);
  const revealed = step?.kind === 'reveal' ? state.population.citizens[step.citizenId] : null;
  return (
    <div className={styles.cinema} data-testid="cinematic" aria-live="polite">
      <div className={`${styles.cinemaBlack} ${view.black ? styles.cinemaBlackOn : ''}`} />
      <div className={styles.letterboxTop} />
      <div className={styles.letterboxBottom}>
        {step?.kind === 'line' && (
          <p className={styles.cinemaLine} key={view.index}>
            {step.speaker && <span className={styles.cinemaSpeaker}>{step.speaker}</span>}
            {step.text}
          </p>
        )}
      </div>
      {step?.kind === 'title' && (
        <div className={styles.cinemaTitle} key={view.index}>
          <h2>{step.title}</h2>
          {step.subtitle && <p>{step.subtitle}</p>}
        </div>
      )}
      {revealed && step?.kind === 'reveal' && (
        <div className={styles.revealCard} key={view.index} data-testid="reveal">
          <Portrait
            genes={revealed.genes}
            sex={revealed.sex}
            age={ageOf(revealed, day)}
            mood={20}
            dead={!revealed.alive}
            size={120}
          />
          <div>
            <p className={styles.revealName}>{fullName(revealed)}</p>
            <p className={styles.slotMeta}>{step.caption}</p>
          </div>
        </div>
      )}
      <button
        type="button"
        className={`${styles.button} ${styles.skip}`}
        onClick={() => player.skip()}
      >
        {t('cine.skip')}
      </button>
    </div>
  );
}
