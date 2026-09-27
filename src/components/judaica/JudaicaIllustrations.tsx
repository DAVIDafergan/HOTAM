// Original line illustrations for the Judaica homepage tiles, seasonal banners and the
// seasonal search button. Stroke uses currentColor, so the caller sets the color.
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

/** Tallit with atarah and tzitzit. */
export function TallitIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.1} {...props}>
      <rect x="14" y="34" width="92" height="52" rx="4" />
      <rect x="42" y="26" width="36" height="14" rx="2" />
      <path d="M46 30 h28 M46 33 h28 M46 36 h28" strokeDasharray="1.5 1.5" />
      <path d="M14 46 h92 M14 50 h92 M14 70 h92 M14 74 h92" />
      <path d="M18 86 v18 M21 86 v16 M24 86 v19 M27 86 v15" />
      <path d="M93 86 v15 M96 86 v19 M99 86 v16 M102 86 v18" />
      <circle cx="22.5" cy="89" r="2" />
      <circle cx="97.5" cy="89" r="2" />
    </svg>
  );
}

/** Kiddush cup on its plate between two Shabbat candlesticks. */
export function SilverIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.1} {...props}>
      <path d="M44 22 h32 v12 c0 13 -7 21 -16 21 c-9 0 -16 -8 -16 -21 z" />
      <path d="M46 30 h28" strokeDasharray="2 1.6" />
      <path d="M60 55 v18" />
      <ellipse cx="60" cy="64" rx="4" ry="2.4" />
      <path d="M48 82 q12 -9 24 0 z" />
      <ellipse cx="60" cy="88" rx="34" ry="6" />
      <path d="M18 36 v42 M102 36 v42" />
      <rect x="15" y="26" width="6" height="12" rx="1" />
      <rect x="99" y="26" width="6" height="12" rx="1" />
      <path d="M18 26 c-3 -4 -2 -8 0 -11 c2 3 3 7 0 11 z M102 26 c-3 -4 -2 -8 0 -11 c2 3 3 7 0 11 z" />
      <path d="M12 38 h12 M96 38 h12" />
      <path d="M10 92 q8 -9 16 0 z M94 92 q8 -9 16 0 z" />
    </svg>
  );
}

/** Knitted kippah. */
export function KippahIllustration(props: IllustrationProps) {
  return (
    <svg {...base} strokeWidth={1.1} {...props}>
      <path d="M12 80 A48 42 0 0 1 108 80 Z" />
      <path d="M26 80 A34 30 0 0 1 94 80" />
      <path d="M40 80 A20 18 0 0 1 80 80" />
      <path d="M19 71 A41 36 0 0 1 101 71" strokeDasharray="2 2.4" />
      <path d="M60 38 v42 M40 45 l10 35 M80 45 l-10 35 M26 58 l20 22 M94 58 l-20 22" />
      <circle cx="60" cy="38" r="2.4" />
    </svg>
  );
}

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
