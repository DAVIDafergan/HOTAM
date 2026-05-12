export const CHAT_BLOCK_ERROR_MESSAGE = 'Contact details are not allowed in chat';

type ChatGuardResult = {
  blocked: boolean;
  reason: string | null;
};

const PHONE_REGEX = /(?:(?:\+|00)\s*972|0)(?:\D*[23489]|\D*5\D*\d)(?:\D*\d){7,8}/u;
const EMAIL_REGEX = /[a-z0-9._%+-]+(?:\s*(?:@|\(at\)|\[at\]| at )\s*)[a-z0-9.-]+(?:\s*(?:\.|\(dot\)|\[dot\]| dot )\s*)[a-z]{2,}/iu;
const URL_REGEX = /(?:https?:\/\/|www\.|wa\.me\/|t\.me\/|discord(?:app)?\.com\/|instagram\.com\/|facebook\.com\/|telegram\.me\/|bit\.ly\/|tinyurl\.com\/)[^\s]+/iu;

const DIGIT_WORDS: Record<string, string> = {
  zero: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
  אפס: '0',
  אחת: '1',
  אחד: '1',
  שתיים: '2',
  שניים: '2',
  שתים: '2',
  שלוש: '3',
  שלושה: '3',
  ארבע: '4',
  ארבעה: '4',
  חמש: '5',
  חמישה: '5',
  שש: '6',
  שישה: '6',
  שבע: '7',
  שבעה: '7',
  שמונה: '8',
  תשע: '9',
  תשעה: '9',
};

const CONTACT_PHRASES = [
  'מספר',
  'טלפון',
  'נייד',
  'פלאפון',
  'סלולרי',
  'וואטסאפ',
  'ווצאפ',
  'whatsapp',
  'phone',
  'call me',
  'contact me',
  'contact',
  'email',
  'אימייל',
  'מייל',
  'צור קשר',
  'תתקשר',
  'מחוץ לאתר',
  'מחוץ למערכת',
  'מחוץ לצאט',
  'בפרטי',
  'באישי',
  'instagram',
  'facebook',
  'telegram',
  'טלגרם',
  'אינסטגרם',
  'פייסבוק',
];

const NAME_SHARING_PHRASES = [
  'קוראים לי',
  'השם שלי',
  'שמי',
  'תחפש אותי',
  'חפש אותי',
  'תחפשי אותי',
  'name is',
  'my name is',
  'look me up',
  'search for me',
  'user name',
  'username',
];

function normalizeMessage(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[_~`'"|,:;()[\]{}<>]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandDigitWords(text: string) {
  return normalizeMessage(text)
    .replace(/[./@+\-]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => DIGIT_WORDS[token] ?? token)
    .join(' ');
}

function hasPhoneNumber(text: string) {
  const expanded = expandDigitWords(normalizeMessage(text));
  const digitsOnly = expanded.replace(/\D+/g, '');

  if (PHONE_REGEX.test(expanded)) return true;
  if (/(?:972|0)(?:[23489]\d{7,8}|5\d{8})/.test(digitsOnly)) return true;

  return false;
}

export function analyzeChatMessage(text: string): ChatGuardResult {
  const normalized = normalizeMessage(text);

  if (!normalized) {
    return { blocked: false, reason: null };
  }

  if (hasPhoneNumber(text)) {
    return { blocked: true, reason: 'מספרי טלפון אסורים בצ׳אט' };
  }

  if (EMAIL_REGEX.test(normalized)) {
    return { blocked: true, reason: 'כתובות אימייל אסורות בצ׳אט' };
  }

  if (URL_REGEX.test(normalized)) {
    return { blocked: true, reason: 'קישורים וערוצי קשר חיצוניים אסורים בצ׳אט' };
  }

  if (CONTACT_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { blocked: true, reason: 'פרטי קשר או ניסיון להעביר שיחה מחוץ למערכת נחסמו' };
  }

  if (NAME_SHARING_PHRASES.some((phrase) => normalized.includes(phrase))) {
    return { blocked: true, reason: 'מסירת שם מזהה לצורך יצירת קשר חיצוני נחסמה' };
  }

  return { blocked: false, reason: null };
}
