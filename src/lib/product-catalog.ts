// Single source of truth for product categories and seller permissions.
//
// Two seller types:
//   - stam_scribe    (סופר סת"ם)    → scribal products + Judaica
//   - judaica_seller (מוכר יודאיקה) → Judaica only
//
// The permission itself is enforced in the database (trigger
// enforce_product_seller_type, docs/add-seller-types-migration.sql) — the lists
// below drive the UI and must stay in sync with that trigger's list.

export type SellerType = 'stam_scribe' | 'judaica_seller';
export type StamUpgradeStatus = 'none' | 'pending' | 'approved' | 'rejected';

export const SELLER_TYPE_LABELS: Record<SellerType, string> = {
  stam_scribe: 'סופר סת"ם',
  judaica_seller: 'מוכר יודאיקה',
};

/** Normalizes a DB value; a missing column (pre-migration) means every seller is a scribe. */
export function resolveSellerType(value: unknown): SellerType {
  return value === 'judaica_seller' ? 'judaica_seller' : 'stam_scribe';
}

// ── Scribal (סת"ם) categories ────────────────────────────────────────────────
// 'מוצרי יודאיקה שונים' is the legacy value for handwritten parchment items
// (פיטום הקטורת, אשת חיל, למנצח, ספר הפטרות) — scribal work, so scribes only.
// Its stored value is kept for existing products; only the label changes.
export const STAM_PRODUCT_TYPES = ['מזוזה', 'תפילין', 'מגילה', 'ספר תורה', 'מוצרי יודאיקה שונים'] as const;

export const STAM_PRODUCT_LABELS: Record<string, string> = {
  'מזוזה': 'מזוזה',
  'תפילין': 'תפילין',
  'מגילה': 'מגילה',
  'ספר תורה': 'ספר תורה',
  'מוצרי יודאיקה שונים': 'מוצרי קלף נוספים',
};

export function isStamProductType(productType: unknown): boolean {
  return typeof productType === 'string' && (STAM_PRODUCT_TYPES as readonly string[]).includes(productType);
}

// ── Judaica categories ───────────────────────────────────────────────────────

export type JudaicaField =
  | { key: string; label: string; type: 'select'; options: string[]; required?: boolean }
  | { key: string; label: string; type: 'multiselect'; options: string[]; required?: boolean }
  | { key: string; label: string; type: 'text'; placeholder?: string; required?: boolean }
  | { key: string; label: string; type: 'toggle'; onLabel: string; offLabel: string };

export type JudaicaCategory = {
  value: string;
  /** Variants stored in products.sub_type (required pick when present). */
  subtypes?: string[];
  fields: JudaicaField[];
  seasonal?: SeasonKey;
  /** Fixed notice shown in the form and on the product page — not editable by the seller. */
  notice?: { text: string; linkLabel: string; href: string };
};

const MATERIALS_METAL = ['כסף', 'כסף 925', 'פליז', 'נחושת', 'אלומיניום', 'עץ', 'זכוכית', 'קרמיקה', 'אחר'];

export const JUDAICA_CATEGORIES: JudaicaCategory[] = [
  {
    value: 'טלית',
    fields: [
      { key: 'size', label: 'גודל', type: 'select', options: ['40', '45', '50', '55', '60', '65', '70', '75', '80', '90'], required: true },
      { key: 'material', label: 'חומר', type: 'select', options: ['צמר', 'פוליאסטר', 'משי'], required: true },
      { key: 'nusach', label: 'נוסח', type: 'select', options: ['אשכנזי', 'ספרדי', 'עדות המזרח'], required: true },
      { key: 'stripe_color', label: 'צבע פסים', type: 'select', options: ['שחור', 'כחול', 'לבן', 'כסף', 'זהב', 'צבעוני'], required: true },
      { key: 'atara', label: 'עטרה', type: 'toggle', onLabel: 'עם עטרה', offLabel: 'בלי עטרה' },
    ],
  },
  {
    value: 'טלית קטן',
    fields: [
      { key: 'size', label: 'מידה', type: 'text', placeholder: 'למשל: 10 או L', required: true },
      { key: 'material', label: 'חומר', type: 'select', options: ['צמר', 'כותנה', 'פוליאסטר', 'רשת (דרייפיט)'], required: true },
    ],
  },
  {
    value: 'כיסוי טלית',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: ['קטיפה', 'עור', 'דמוי עור', 'בד', 'אחר'], required: true },
      { key: 'name_embroidery', label: 'רקמת שם', type: 'toggle', onLabel: 'עם רקמת שם', offLabel: 'בלי רקמה' },
    ],
  },
  {
    value: 'תיק תפילין',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: ['קטיפה', 'עור', 'דמוי עור', 'בד', 'אחר'], required: true },
      { key: 'color', label: 'צבע', type: 'text', placeholder: 'למשל: כחול כהה', required: true },
      { key: 'embroidery', label: 'רקמה', type: 'toggle', onLabel: 'עם רקמה', offLabel: 'בלי רקמה' },
    ],
  },
  {
    value: 'חנוכיה',
    seasonal: 'hanukkah',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: ['כסף', 'פליז', 'נחושת', 'עץ', 'זכוכית'], required: true },
      { key: 'style', label: 'סגנון', type: 'select', options: ['קלאסי', 'מודרני', 'מסורתי', 'לילדים'], required: true },
      { key: 'size', label: 'גודל', type: 'select', options: ['קטנה', 'בינונית', 'גדולה'], required: true },
      { key: 'fuel', label: 'הדלקה', type: 'select', options: ['לנרות', 'לשמן', 'נרות ושמן'], required: true },
    ],
  },
  {
    value: 'ארבעת המינים',
    seasonal: 'sukkot',
    subtypes: ['סט מלא', 'אתרוג', 'לולב', 'הדסים', 'ערבות'],
    fields: [
      { key: 'hechsher', label: 'הכשר', type: 'text', placeholder: 'שם הרב / המערכת המכשירה', required: true },
      { key: 'level', label: 'רמת הידור', type: 'select', options: ['כשר', 'מהודר', 'מהודר מאד'], required: true },
      { key: 'etrog_origin', label: 'זן / מקור האתרוג', type: 'text', placeholder: 'למשל: תימני, מרוקאי, קלבריה (אם רלוונטי)' },
    ],
  },
  {
    value: 'שופר',
    seasonal: 'rosh_hashana',
    fields: [
      { key: 'kind', label: 'סוג', type: 'select', options: ['איל', 'קודו (תימני)', 'אחר'], required: true },
      { key: 'length', label: 'אורך (ס"מ)', type: 'text', placeholder: 'למשל: 30-35', required: true },
      { key: 'finish', label: 'גימור', type: 'select', options: ['מלוטש', 'טבעי', 'חצי מלוטש'], required: true },
    ],
  },
  {
    value: 'בית מזוזה',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: MATERIALS_METAL, required: true },
      { key: 'size', label: 'גודל (לקלף בגודל, ס"מ)', type: 'text', placeholder: 'למשל: 10, 12 או 15', required: true },
      { key: 'style', label: 'סגנון', type: 'select', options: ['קלאסי', 'מודרני', 'מסורתי', 'לילדים'], required: true },
    ],
    notice: {
      text: 'מוצר זה כולל בית בלבד, ללא קלף. יש לרכוש קלף מזוזה כשר בנפרד מסופר סת"ם מאומת.',
      linkLabel: 'לחיפוש מזוזות באתר',
      // view=results opens the results list directly (without it /search shows the intro screen).
      href: '/search?view=results&product=' + encodeURIComponent('מזוזה'),
    },
  },
  {
    value: 'כיפה',
    fields: [
      { key: 'kind', label: 'סוג', type: 'select', options: ['סרוגה', 'קטיפה', 'בד', 'עור', 'אחר'], required: true },
      { key: 'size', label: 'גודל', type: 'text', placeholder: 'למשל: 14 ס"מ או מס\' 3', required: true },
      { key: 'color', label: 'צבע / דוגמה', type: 'text', placeholder: 'למשל: שחור, לבן עם פס כחול', required: true },
    ],
  },
  {
    value: 'סט קידוש',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: MATERIALS_METAL, required: true },
      { key: 'parts', label: 'חלקים כלולים', type: 'multiselect', options: ['גביע', 'תחתית / צלחת', 'בקבוק', 'כוסיות', 'מגש', 'מזרקה'], required: true },
    ],
  },
  {
    value: 'פמוטי שבת',
    fields: [
      { key: 'material', label: 'חומר', type: 'select', options: MATERIALS_METAL, required: true },
      { key: 'height', label: 'גובה (ס"מ)', type: 'text', placeholder: 'למשל: 25', required: true },
      { key: 'branches', label: 'מספר קנים', type: 'select', options: ['1', '2', '3', '5', '7'], required: true },
    ],
  },
];

export const JUDAICA_PRODUCT_TYPES = JUDAICA_CATEGORIES.map((c) => c.value);

export function getJudaicaCategory(productType: unknown): JudaicaCategory | undefined {
  return JUDAICA_CATEGORIES.find((c) => c.value === productType);
}

export function isJudaicaProductType(productType: unknown): boolean {
  return Boolean(getJudaicaCategory(productType));
}

export type ProductAttributes = Record<string, string | string[] | boolean>;

/** Returns the first missing required field's label, or null when the attributes are complete. */
export function findMissingJudaicaField(category: JudaicaCategory, attributes: ProductAttributes): string | null {
  for (const field of category.fields) {
    if (field.type === 'toggle' || !field.required) continue;
    const value = attributes[field.key];
    const empty = Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim();
    if (empty) return field.label;
  }
  return null;
}

/**
 * Keeps only the category's own keys (drops leftovers from a previously picked category)
 * and stores untouched toggles as false, since the form shows them as "off" by default.
 */
export function normalizeJudaicaAttributes(category: JudaicaCategory, attributes: ProductAttributes): ProductAttributes {
  const normalized: ProductAttributes = {};
  for (const field of category.fields) {
    const value = attributes[field.key];
    if (field.type === 'toggle') normalized[field.key] = value === true;
    else if (value !== undefined && value !== '') normalized[field.key] = value;
  }
  return normalized;
}

/** Human-readable [label, value] pairs for the product page spec list. */
export function describeJudaicaAttributes(category: JudaicaCategory, attributes: ProductAttributes): [string, string][] {
  const rows: [string, string][] = [];
  for (const field of category.fields) {
    const value = attributes?.[field.key];
    if (field.type === 'toggle') {
      if (typeof value === 'boolean') rows.push([field.label, value ? field.onLabel : field.offLabel]);
      continue;
    }
    const text = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
    if (text) rows.push([field.label, text]);
  }
  return rows;
}

// ── Seasonality ──────────────────────────────────────────────────────────────
// שופר, ארבעת המינים and חנוכיה are sold all year. Inside their window (Hebrew
// calendar, Israel time) they get a homepage banner; outside it they carry a
// "seasonal" badge so buyers understand it's a holiday item.

export type SeasonKey = 'rosh_hashana' | 'sukkot' | 'hanukkah';

export type Season = {
  key: SeasonKey;
  /** The Judaica category (products.product_type) this season promotes. */
  category: string;
  /** Plural display name for banners. */
  title: string;
  /** "לקראת …" — the seasonal search button and the badge. */
  towards: string;
  /** Banner chip: how long the window lasts. */
  until: string;
  /** Banner button. */
  cta: string;
  description: string;
};

export const SEASONS: Season[] = [
  { key: 'rosh_hashana', category: 'שופר', title: 'שופרות', towards: 'לקראת ראש השנה', until: 'עד ראש השנה', cta: 'לכל השופרות', description: 'שופר איל ושופר קודו, בכל הגדלים' },
  { key: 'sukkot', category: 'ארבעת המינים', title: 'ארבעת המינים', towards: 'לקראת סוכות', until: 'עד סוף סוכות', cta: 'לכל ארבעת המינים', description: 'לולב, אתרוג, הדסים וערבות' },
  { key: 'hanukkah', category: 'חנוכיה', title: 'חנוכיות', towards: 'לקראת חנוכה', until: 'עד סוף חנוכה', cta: 'לכל החנוכיות', description: 'חנוכיות לנרות ולשמן, ממוכרים מאומתים' },
];

type HebrewDay = { month: string; day: number };

/** The Hebrew date in Israel (civil day, Asia/Jerusalem) — the same on the server and in the browser. */
function hebrewDay(date: Date): HebrewDay | null {
  try {
    const parts = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long', day: 'numeric', timeZone: 'Asia/Jerusalem' }).formatToParts(date);
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const day = Number(parts.find((p) => p.type === 'day')?.value || 0);
    return month && day ? { month, day } : null;
  } catch {
    return null;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hanukkah runs 25 Kislev + 7 days, so it ends on 2 or 3 Tevet depending on Kislev's length. */
function isHanukkahWindow(date: Date, today: HebrewDay): boolean {
  if (today.month === 'Kislev') return true;
  if (today.month !== 'Tevet') return false;
  for (let back = 0; back <= 7; back++) {
    const d = hebrewDay(new Date(date.getTime() - back * DAY_MS));
    if (d && d.month === 'Kislev' && d.day === 25) return true;
  }
  return false;
}

/**
 * Windows: שופר 1 Elul – Erev Rosh Hashana; ארבעת המינים 1 Elul – 22 Tishrei;
 * חנוכיה 1 Kislev – last day of Hanukkah.
 */
export function isSeasonActive(key: SeasonKey, date: Date = new Date()): boolean {
  const today = hebrewDay(date);
  if (!today) return false;
  if (key === 'rosh_hashana') return today.month === 'Elul';
  if (key === 'sukkot') return today.month === 'Elul' || (today.month === 'Tishri' && today.day <= 22);
  return isHanukkahWindow(date, today);
}

export function getActiveSeasons(date: Date = new Date()): Season[] {
  return SEASONS.filter((season) => isSeasonActive(season.key, date));
}

/** Days left in a season's window, counting today (for "נותרו X ימים"). */
export function daysLeftInSeason(key: SeasonKey, date: Date = new Date()): number {
  let days = 0;
  while (days < 60 && isSeasonActive(key, new Date(date.getTime() + (days + 1) * DAY_MS))) days++;
  return days + 1;
}

/** True from 1 Elul through 22 Tishrei (end of Sukkot), by the Hebrew calendar. */
export function isSukkotSeason(date: Date = new Date()): boolean {
  return isSeasonActive('sukkot', date);
}

export function getCategorySeason(productType: unknown): Season | undefined {
  const key = getJudaicaCategory(productType)?.seasonal;
  return key ? SEASONS.find((season) => season.key === key) : undefined;
}

export function isSeasonalCategory(productType: unknown): boolean {
  return Boolean(getCategorySeason(productType));
}

/** Badge text for a seasonal category, e.g. "עונתי - לקראת חנוכה". */
export function seasonalBadgeLabel(productType: unknown): string {
  const season = getCategorySeason(productType);
  return season ? `עונתי - ${season.towards}` : '';
}

/** The badge shows outside the category's own window. `activeSeasons` null = not known yet (before mount). */
export function shouldShowSeasonalBadge(productType: unknown, activeSeasons: ReadonlySet<SeasonKey> | null): boolean {
  const season = getCategorySeason(productType);
  return Boolean(season && activeSeasons && !activeSeasons.has(season.key));
}

// ── Category groups (homepage tiles, seasonal button → /search?group=…) ─────

export type ProductGroup = { key: string; label: string; types: string[] };

export const PRODUCT_GROUPS: ProductGroup[] = [
  { key: 'tallit', label: 'טליתות ואביזרים', types: ['טלית', 'טלית קטן', 'כיסוי טלית', 'תיק תפילין'] },
  { key: 'silver', label: 'כלי כסף לשולחן', types: ['סט קידוש', 'פמוטי שבת'] },
  { key: 'kippah', label: 'כיפות', types: ['כיפה'] },
  { key: 'holiday', label: 'מוצרי חג', types: SEASONS.map((season) => season.category) },
  { key: 'high_holidays', label: 'לראש השנה וסוכות', types: ['שופר', 'ארבעת המינים'] },
];

export function getProductGroup(key: unknown): ProductGroup | undefined {
  return PRODUCT_GROUPS.find((group) => group.key === key);
}

export type SeasonalShortcut = { label: string; href: string; season: SeasonKey | null };

/**
 * The sixth search-area button: "לקראת ראש השנה / סוכות / חנוכה" in season (Elul shows the
 * Rosh Hashana label but leads to both שופר and ארבעת המינים), "מוצרי חג" between holidays.
 */
export function getSeasonalShortcut(date: Date = new Date()): SeasonalShortcut {
  const active = getActiveSeasons(date);
  if (active.length === 0) return { label: 'מוצרי חג', href: '/search?view=results&group=holiday', season: null };
  if (active.length > 1) return { label: active[0].towards, href: '/search?view=results&group=high_holidays', season: active[0].key };
  const [season] = active;
  return { label: season.towards, href: `/search?view=results&product=${encodeURIComponent(season.category)}`, season: season.key };
}
