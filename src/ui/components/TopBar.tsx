import { t } from '../../content/i18n.ts';
import type { GameSession, GameSpeed } from '../../game/session.ts';
import {
  FastIcon,
  FastestIcon,
  LedgerIcon,
  MenuIcon,
  PauseIcon,
  PlayIcon,
} from '../icons/Icons.tsx';
import { formatCountdown, formatDate, formatHour } from '../format.ts';
import { useSession } from '../useSession.ts';
import styles from '../ui.module.css';

const SPEEDS: {
  speed: GameSpeed;
  label: Parameters<typeof t>[0];
  icon: () => React.JSX.Element;
  key: string;
}[] = [
  { speed: 0, label: 'speed.pause', icon: PauseIcon, key: 'Espacio' },
  { speed: 1, label: 'speed.x1', icon: PlayIcon, key: '1' },
  { speed: 2, label: 'speed.x2', icon: FastIcon, key: '2' },
  { speed: 4, label: 'speed.x4', icon: FastestIcon, key: '3' },
];

interface Props {
  session: GameSession;
  onSave(): void;
  onMenu(): void;
}

export function TopBar({ session, onSave, onMenu }: Props) {
  const { state, speed } = useSession(session);
  const inDistrict = state.phase.kind === 'district';
  return (
    <header className={`${styles.panel} ${styles.topBar}`} data-testid="top-bar">
      <span className={styles.district}>{t('district.d12.name')}</span>
      <div className={styles.calendar}>
        <span className={styles.date} data-testid="date">
          {formatDate(state.clock.tick)} · {formatHour(state.clock.tick)}
        </span>
        {inDistrict && (
          <span className={styles.countdown} data-testid="countdown">
            {formatCountdown(state)}
          </span>
        )}
      </div>
      <span className={styles.spacer} />
      {inDistrict && (
        <div className={styles.group} role="group" aria-label="Velocidad">
          {SPEEDS.map(({ speed: s, label, icon: Icon, key }) => (
            <button
              key={s}
              type="button"
              className={styles.iconButton}
              aria-pressed={speed === s}
              aria-label={t(label)}
              title={`${t(label)} (${key})`}
              onClick={() => session.setSpeed(s)}
            >
              <Icon />
            </button>
          ))}
        </div>
      )}
      <div className={styles.group}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('hud.save')}
          title={t('hud.save')}
          onClick={onSave}
        >
          <LedgerIcon />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t('hud.menu')}
          title={t('hud.menu')}
          onClick={onMenu}
        >
          <MenuIcon />
        </button>
      </div>
    </header>
  );
}
