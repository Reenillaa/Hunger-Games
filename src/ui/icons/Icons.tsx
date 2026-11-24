import type { SVGProps } from 'react';

/** In-house icon set: 24px grid, 1.5px stroke, square caps (ART_BIBLE §7). No emoji. */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  );
}

export const PauseIcon = () => (
  <Icon>
    <path d="M8 5v14M16 5v14" />
  </Icon>
);
export const PlayIcon = () => (
  <Icon>
    <path d="M7 5l11 7-11 7z" />
  </Icon>
);
export const FastIcon = () => (
  <Icon>
    <path d="M4 6l7 6-7 6zM12 6l7 6-7 6z" />
  </Icon>
);
export const FastestIcon = () => (
  <Icon>
    <path d="M2 7l5 5-5 5zM9 7l5 5-5 5zM16 7l5 5-5 5z" />
  </Icon>
);
export const LedgerIcon = () => (
  <Icon>
    <path d="M5 4h11l3 3v13H5zM9 4v6h6V4M8 15h8M8 18h5" />
  </Icon>
);
export const MenuIcon = () => (
  <Icon>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);
/** Emblem of the Capitol (original): twelve rays — the districts — converging on a cut gem. */
export const EmblemIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props}>
    <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path
      d="M39.12 5.44L39.89 2.54 M51.45 12.55L53.57 10.43 M58.56 24.88L61.46 24.11 M58.56 39.12L61.46 39.89 M51.45 51.45L53.57 53.57 M39.12 58.56L39.89 61.46 M24.88 58.56L24.11 61.46 M12.55 51.45L10.43 53.57 M5.44 39.12L2.54 39.89 M5.44 24.88L2.54 24.11 M12.55 12.55L10.43 10.43 M24.88 5.44L24.11 2.54"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M28.76 7.21L32.00 21.00L35.24 7.21Z M41.59 8.91L37.50 22.47L47.20 12.15Z M51.85 16.80L41.53 26.50L55.09 22.41Z M56.79 28.76L43.00 32.00L56.79 35.24Z M55.09 41.59L41.53 37.50L51.85 47.20Z M47.20 51.85L37.50 41.53L41.59 55.09Z M35.24 56.79L32.00 43.00L28.76 56.79Z M22.41 55.09L26.50 41.53L16.80 51.85Z M12.15 47.20L22.47 37.50L8.91 41.59Z M7.21 35.24L21.00 32.00L7.21 28.76Z M8.91 22.41L22.47 26.50L12.15 16.80Z M16.80 12.15L26.50 22.47L22.41 8.91Z"
      fill="currentColor"
      opacity="0.85"
    />
    <path d="M32 22L39 28L36.5 39H27.5L25 28Z" fill="currentColor" />
    <path
      d="M25 28H39M32 22L29.5 28L32 39L34.5 28Z"
      fill="none"
      stroke="#16161a"
      strokeWidth="0.9"
      opacity="0.55"
    />
  </svg>
);

export const ChronicleIcon = () => (
  <Icon>
    <path d="M6 4h10a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2zM6 18a2 2 0 0 1 2-2h10M10 8h5M10 11h5" />
  </Icon>
);
export const GearIcon = () => (
  <Icon>
    <path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  </Icon>
);

/** Season glyphs for the calendar plaque (sprout, sun, falling leaf, snowflake). */
export const SeasonIcon = ({ season }: { season: 'spring' | 'summer' | 'autumn' | 'winter' }) => (
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    aria-hidden="true"
    focusable="false"
    className="season"
  >
    {season === 'spring' && (
      <path
        d="M12 21v-8M12 13c0-4 3-6 7-6-0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z"
        fill="#8fbf5a"
        stroke="#4e7a2a"
        strokeWidth="1.2"
      />
    )}
    {season === 'summer' && (
      <g stroke="#f2c14e" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.5" fill="#f2c14e" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </g>
    )}
    {season === 'autumn' && (
      <path
        d="M5 19C5 10 11 5 19 5c0 8-5 14-14 14zM5 19l8-8"
        fill="#c86b2a"
        stroke="#7a3a14"
        strokeWidth="1.4"
      />
    )}
    {season === 'winter' && (
      <g stroke="#bfe0f2" strokeWidth="1.8" strokeLinecap="round">
        <path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3" fill="none" />
      </g>
    )}
  </svg>
);

/* ---- resources (same grid and stroke as the HUD icons) ---- */
export const FoodIcon = () => (
  <Icon>
    <path d="M4 14c0-4 3.5-7 8-7s8 3 8 7v3H4zM8 10v3M12 9v4M16 10v3" />
  </Icon>
);
export const WoodIcon = () => (
  <Icon>
    <path d="M3 9h14l4 3-4 3H3zM7 9v6M17 9a2 3 0 0 1 0 6" />
  </Icon>
);
export const StoneIcon = () => (
  <Icon>
    <path d="M4 16l3-8 6-2 6 4 1 6-8 3zM7 8l5 4 7-2M12 12l0 7" />
  </Icon>
);
export const CoalIcon = () => (
  <Icon>
    <path d="M5 15l2-6 5-3 6 3 1 6-6 4z" fill="currentColor" fillOpacity="0.35" />
  </Icon>
);
export const CreditsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="7" />
    <path d="M12 7v10M9 10h6" />
  </Icon>
);
export const HammerIcon = () => (
  <Icon>
    <path d="M14 4l6 6-3 3-6-6zM12 8L4 16l3 3 8-8" />
  </Icon>
);
export const PeopleIcon = () => (
  <Icon>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 19c0-3 3-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.5M18 14c2 .6 3 2.4 3 5" />
  </Icon>
);
