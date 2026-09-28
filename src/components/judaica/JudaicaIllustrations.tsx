// Original line illustrations for the seasonal banners and the seasonal search button.
// Stroke uses currentColor, so the caller sets the color.
import type { SVGProps } from 'react';
import type { SeasonKey } from '@/lib/product-catalog';

type IllustrationProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: '0 0 120 120',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** Lulav bound with myrtle and willow, and an etrog. */
export function ArbaMinimIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <path d="M54 112 L58 8" />
      <path d="M57.5 24 C47 18 42 11 40 4" />
      <path d="M57.5 24 C66 16 70 9 72 3" />
      <path d="M56.8 38 C44 32 38 23 34 15" />
      <path d="M56.8 38 C68 30 74 22 78 13" />
      <path d="M56 52 C45 48 38 41 34 33" />
      <path d="M56 52 C67 46 73 39 77 30" />
      <path d="M55.4 66 C47 63 42 58 39 52" />
      <path d="M55.4 66 C63 62 68 57 71 50" />
      <path d="M47 104 L38 54" />
      <path d="M40.5 66 l-5 -3 M42 76 l-5.5 -3 M43.8 86 l-5.5 -3 M39.5 60 l4 -4 M41 70 l4.5 -4 M43 80 l4.5 -4" />
      <path d="M62 104 L70 56" />
      <ellipse cx="70.5" cy="62" rx="2.4" ry="1.4" />
      <ellipse cx="68.8" cy="70" rx="2.4" ry="1.4" />
      <ellipse cx="67.2" cy="78" rx="2.4" ry="1.4" />
      <ellipse cx="65.6" cy="86" rx="2.4" ry="1.4" />
      <ellipse cx="73.5" cy="66" rx="2.4" ry="1.4" />
      <ellipse cx="71.8" cy="74" rx="2.4" ry="1.4" />
      <path d="M48 90 h16 M48.5 95 h15 M49 100 h14" />
      <ellipse cx="92" cy="94" rx="14" ry="17" />
      <path d="M92 77 v-4" />
    </svg>
  );
}

/** A ram's-horn shofar. */
export function ShofarIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <path d="M10 92 C40 94 70 82 88 56 C96 44 100 30 106 12" />
      <path d="M16 104 C50 106 82 92 98 62 C104 50 108 36 114 18" />
      <path d="M106 12 L114 18" />
      <path d="M10 92 L16 104" />
      <path d="M30 94 l1.5 10 M46 91 l2.5 9.5 M61 85 l3.5 8.5 M74 76 l5 7 M85 64 l6 5.5 M93 50 l6.5 3.5 M99 36 l7 2" />
    </svg>
  );
}

/** Nine-branch hanukkiah with lit flames. */
export function HanukkiahIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.3} {...props}>
      <path d="M60 20 V100" />
      <path d="M44 106 h32 M50 100 h20" />
      <path d="M20 40 V36 A40 40 0 0 0 100 36 V40" />
      <path d="M30 40 V46 A30 30 0 0 0 90 46 V40" />
      <path d="M40 40 V56 A20 20 0 0 0 80 56 V40" />
      <path d="M50 40 V66 A10 10 0 0 0 70 66 V40" />
      <path d="M16 40 h8 M26 40 h8 M36 40 h8 M46 40 h8 M66 40 h8 M76 40 h8 M86 40 h8 M96 40 h8 M56 22 h8" />
      <path d="M20 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M30 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M40 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M50 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M70 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M80 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M90 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M100 34 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z M60 16 c-2 -3 -2 -5 0 -8 c2 3 2 5 0 8z" />
    </svg>
  );
}

/** Calendar with a star — the between-holidays "מוצרי חג" state. */
export function HolidayIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.4} {...props}>
      <rect x="16" y="22" width="88" height="82" rx="14" />
      <path d="M16 46 h88 M40 12 v18 M80 12 v18" />
      <path d="M60 58 l5 10 11 1.6 -8 7.8 1.9 11 -9.9 -5.2 -9.9 5.2 1.9 -11 -8 -7.8 11 -1.6 z" />
    </svg>
  );
}

export function SeasonIllustration({ season, ...props }: IllustrationProps & { season: SeasonKey | null }) {
  if (season === 'rosh_hashana') return <ShofarIllustration {...props} />;
  if (season === 'sukkot') return <ArbaMinimIllustration {...props} />;
  if (season === 'hanukkah') return <HanukkiahIllustration {...props} />;
  return <HolidayIllustration {...props} />;
}
