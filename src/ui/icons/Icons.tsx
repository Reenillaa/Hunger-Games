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
