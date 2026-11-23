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
/** Emblem: a coal shard split by the tithe line. */
export const EmblemIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...props}>
    <path d="M32 4 56 22 48 58H16L8 22Z" fill="none" stroke="currentColor" strokeWidth="3" />
    <path d="M32 4v54M8 22h48" stroke="currentColor" strokeWidth="2" opacity="0.6" />
    <circle cx="32" cy="34" r="5" fill="currentColor" />
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
