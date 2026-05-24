'use client';

export const UNKNOWN_CITY_LABEL = 'עיר לא ידועה';
export const NEARBY_RADIUS_KM = 30;
export const COMMON_CITY_OPTIONS = [
  'אופקים',
  'אור יהודה',
  'אילת',
  'אלעד',
  'אשדוד',
  'אשקלון',
  'באר שבע',
  'בית שמש',
  'ביתר עילית',
  'בני ברק',
  'בת ים',
  'גבעתיים',
  'דימונה',
  'הוד השרון',
  'הרצליה',
  'חדרה',
  'חולון',
  'חיפה',
  'טבריה',
  'יבנה',
  'יהוד',
  'ירוחם',
  'ירושלים',
  'כפר סבא',
  'כרמיאל',
  'לוד',
  'מודיעין',
  'מודיעין עילית',
  'מעלה אדומים',
  'נהריה',
  'נתניה',
  'עכו',
  'עפולה',
  'פתח תקווה',
  'פרדסיה',
  'צפת',
  'קדימה',
  'קריות',
  'קריית אונו',
  'ראשון לציון',
  'רחובות',
  'רמלה',
  'רמת גן',
  'רמת השרון',
  'רעננה',
  'שוהם',
  'תל אביב',
  'תל אביב-יפו',
] as const;

const HEBREW_ARTICLE_PREFIX = /^ה(?=\s)/;
const HEBREW_CITY_PREFIX = /^עיר\s+/;

const CITY_ALIAS_PAIRS = [
  ['raanana', 'רעננה'],
  ['tel aviv', 'תל אביב'],
  ['tel aviv', 'תל אביב-יפו'],
  ['jerusalem', 'ירושלים'],
  ['haifa', 'חיפה'],
] as const;

export const normalizeCity = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const CITY_ALIASES: Record<string, string[]> = CITY_ALIAS_PAIRS.reduce((acc, [a, b]) => {
  const left = normalizeCity(a);
  const right = normalizeCity(b);
  acc[left] = Array.from(new Set([...(acc[left] || []), right]));
  acc[right] = Array.from(new Set([...(acc[right] || []), left]));
  return acc;
}, {} as Record<string, string[]>);

const toCityLabel = (value: string) =>
  value
    .replace(HEBREW_ARTICLE_PREFIX, '')
    .replace(HEBREW_CITY_PREFIX, '')
    .trim();

const tokenizeLocationValue = (value: string) =>
  value
    .split(/[,/|]/)
    .map((item) => item.trim())
    .filter(Boolean);

const pickValidCity = (values: string[]) =>
  values.find((value) => {
    const normalized = normalizeCity(value);
    return normalized && normalized !== normalizeCity('כל הארץ');
  }) || null;

export const getCityCandidates = (city: string) => {
  const normalized = normalizeCity(city);
  return Array.from(
    new Set([
      normalized,
      normalized.replace(HEBREW_ARTICLE_PREFIX, '').replace(HEBREW_CITY_PREFIX, '').trim(),
      ...(CITY_ALIASES[normalized] || []),
    ].filter(Boolean)),
  );
};

export function extractCityFromLocationText(value?: string | null): string | null {
  if (!value) return null;
  const parts = tokenizeLocationValue(value);
  const city = pickValidCity(parts) || pickValidCity([value]);
  return city ? toCityLabel(city) : null;
}

export function getProductCityTokens(product: any, seller: any): string[] {
  const rawValues = [
    seller?.city,
    extractCityFromLocationText(seller?.address),
    extractCityFromLocationText(product?.pickup_address),
    ...(Array.isArray(product?.delivery_area) ? product.delivery_area : product?.delivery_area ? [product.delivery_area] : []),
  ]
    .flatMap((value) => (typeof value === 'string' ? tokenizeLocationValue(value) : []))
    .map(toCityLabel)
    .filter(Boolean);

  return Array.from(new Set(rawValues.map(normalizeCity).filter(Boolean)));
}

export function getProductPrimaryCity(product: any, seller: any): string | null {
  return (
    seller?.city ||
    extractCityFromLocationText(product?.pickup_address) ||
    extractCityFromLocationText(seller?.address) ||
    extractCityFromLocationText(
      (Array.isArray(product?.delivery_area) ? product.delivery_area : [product?.delivery_area]).find(Boolean),
    )
  );
}

export function buildAvailableCities(products: any[] = [], sellers: any[] = []): string[] {
  const byNormalized = new Map<string, string>();

  const addCity = (city?: string | null) => {
    if (!city) return;
    const label = toCityLabel(city);
    const normalized = normalizeCity(label);
    if (!normalized || normalized === normalizeCity('כל הארץ')) return;
    if (!byNormalized.has(normalized)) {
      byNormalized.set(normalized, label);
    }
  };

  sellers.forEach((seller) => {
    addCity(seller?.city);
    addCity(extractCityFromLocationText(seller?.address));
  });

  products.forEach((product) => {
    addCity(extractCityFromLocationText(product?.pickup_address));
    const deliveryAreas = Array.isArray(product?.delivery_area) ? product.delivery_area : product?.delivery_area ? [product.delivery_area] : [];
    deliveryAreas.forEach((area: string) => tokenizeLocationValue(area).forEach(addCity));
  });

  COMMON_CITY_OPTIONS.forEach(addCity);

  return Array.from(byNormalized.values()).sort((a, b) => a.localeCompare(b, 'he'));
}

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
