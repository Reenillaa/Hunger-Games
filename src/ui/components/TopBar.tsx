import { homeProfile } from '../../content/homeDistricts.ts';
import { t } from '../../content/i18n.ts';
import type { GameSession, GameSpeed } from '../../game/session.ts';
import {
  ChronicleIcon,
  FastIcon,
  GearIcon,
  FastestIcon,
  LedgerIcon,
  MenuIcon,
  PauseIcon,
  PeopleIcon,
  PlayIcon,
} from '../icons/Icons.tsx';
import { dateFromTick } from '../../core/index.ts';
import { formatCountdown, formatDate, formatHour } from '../format.ts';
import { EmblemIcon, SeasonIcon } from '../icons/Icons.tsx';
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
  const date = dateFromTick(state.clock.tick);
  const hourAngle = ((date.hour % 12) / 12) * 360;
  const isNight = date.hour < 6 || date.hour >= 20;
  return (
    <header className={styles.hudTop} data-testid="top-bar">
      <div className={styles.crest}>
        <span className={styles.crestMedal}>
          <EmblemIcon />
        </span>
        <span className={styles.crestRibbon}>
          {t('map.district', { n: homeProfile(state.meta.homeDistrictId).number })}
        </span>
      </div>

      <div className={styles.datePlaque}>
        <svg className={styles.clockDial} viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="18" className={isNight ? styles.dialNight : styles.dialDay} />
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1="20"
              y1="4"
              x2="20"
              y2={i % 3 === 0 ? 8 : 6}
              transform={`rotate(${i * 30} 20 20)`}
              className={styles.dialTick}
            />
          ))}
          <line
            x1="20"
            y1="20"
            x2="20"
            y2="9"
            transform={`rotate(${hourAngle} 20 20)`}
            className={styles.dialHand}
          />
          <circle cx="20" cy="20" r="2" className={styles.dialPin} />
        </svg>
        <div className={styles.calendar}>
          <span className={styles.date} data-testid="date">
            <SeasonIcon season={date.season} />
            {formatDate(state.clock.tick)} · {formatHour(state.clock.tick)}
          </span>
          {inDistrict && (
            <span className={styles.countdown} data-testid="countdown">
              {formatCountdown(state)}
            </span>
          )}
        </div>
      </div>

      <div className={styles.hudRight}>
        {inDistrict && (
          <div className={styles.speedDial} role="group" aria-label="Velocidad">
            {SPEEDS.map(({ speed: s, label, icon: Icon, key }) => (
              <button
                key={s}
                type="button"
                className={styles.medal}
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
        <div className={styles.medalRow}>
          {[
            {
              label: t('pop.title'),
              icon: <PeopleIcon />,
              on: () => session.ui.togglePanel('population'),
            },
            {
              label: t('chr.open'),
              icon: <ChronicleIcon />,
              on: () => session.ui.togglePanel('chronicle'),
            },
            { label: t('hud.save'), icon: <LedgerIcon />, on: onSave },
            {
              label: t('set.open'),
              icon: <GearIcon />,
              on: () => session.ui.togglePanel('settings'),
            },
            { label: t('hud.menu'), icon: <MenuIcon />, on: onMenu },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              className={`${styles.medal} ${styles.medalSmall}`}
              aria-label={b.label}
              title={b.label}
              onClick={b.on}
            >
              {b.icon}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
