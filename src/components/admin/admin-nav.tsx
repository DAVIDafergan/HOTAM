import type { ReactNode } from 'react';
import {
  Activity, BellRing, CheckCircle2, Clock, Flag, History, Inbox, LayoutDashboard, MessageSquare,
  Receipt, Scroll, Send, ShoppingBag, UserRound,
} from 'lucide-react';

// The admin's sections, grouped the way the owner thinks about the work: what needs me, sellers,
// customers and orders, communication, and the system log. The id is what ?tab= holds in the URL.

export type AdminTabId =
  | 'overview' | 'activity'
  | 'pending' | 'active' | 'judaica'
  | 'customers' | 'sales' | 'torah'
  | 'inquiries' | 'reports' | 'chats' | 'broadcast' | 'notifications'
  | 'audit';

export type AdminNavItem = { id: AdminTabId; label: string; hint: string; icon: ReactNode };

const i = (C: typeof Activity) => <C className="h-[18px] w-[18px]" aria-hidden />;

export const ADMIN_NAV: { group: string; items: AdminNavItem[] }[] = [
  {
    group: 'סקירה',
    items: [
      { id: 'overview', label: 'מה דורש טיפול', hint: 'מה מחכה לך עכשיו, ותמונת מצב של האתר', icon: i(LayoutDashboard) },
      { id: 'activity', label: 'פעילות באתר', hint: 'כל הפעולות שנרשמו באתר, לפי משתמש וסוג', icon: i(Activity) },
    ],
  },
  {
    group: 'מוכרים',
    items: [
      { id: 'pending', label: 'ממתינים לאישור', hint: 'מוכרים חדשים ובקשות שדרוג לסופר סת"ם', icon: i(Clock) },
      { id: 'active', label: 'סופרי סת"ם', hint: 'סופרים מאושרים — פרטים, עריכה ואימות', icon: i(CheckCircle2) },
      { id: 'judaica', label: 'מוכרי יודאיקה', hint: 'מוכרי יודאיקה מאושרים', icon: i(ShoppingBag) },
    ],
  },
  {
    group: 'לקוחות והזמנות',
    items: [
      { id: 'customers', label: 'לקוחות', hint: 'כל הלקוחות הרשומים, ההזמנות שלהם ועדכוני הטלפון', icon: i(UserRound) },
      { id: 'sales', label: 'הזמנות', hint: 'יומן המכירות, כולל הזמנות תקועות', icon: i(Receipt) },
      { id: 'torah', label: 'בקשות ספר תורה', hint: 'לקוחות שביקשו ספר תורה — פרטי קשר לקונה ולסופר', icon: i(Scroll) },
    ],
  },
  {
    group: 'פניות ותקשורת',
    items: [
      { id: 'inquiries', label: 'פניות', hint: 'הודעות שהגיעו מטופס צור קשר', icon: i(Inbox) },
      { id: 'reports', label: 'דיווחים', hint: 'דיווחים של לקוחות על מוכרים', icon: i(Flag) },
      { id: 'chats', label: 'שיחות', hint: 'שיחות בין קונים למוכרים (קריאה בלבד)', icon: i(MessageSquare) },
      { id: 'broadcast', label: 'דיוור', hint: 'מייל (ו-SMS למי שהסכים) לכל המוכרים או הלקוחות', icon: i(Send) },
      { id: 'notifications', label: 'הודעות SMS ושיחות', hint: 'כל הודעות ה-SMS והשיחות הקוליות שנשלחו, ומה נכשל', icon: i(BellRing) },
    ],
  },
  {
    group: 'מערכת',
    items: [
      { id: 'audit', label: 'יומן ביקורת', hint: 'שינויים רגישים: אישורים, מחיקות, פרטי בנק והרשאות', icon: i(History) },
    ],
  },
];

export const ADMIN_TAB_IDS = ADMIN_NAV.flatMap((g) => g.items.map((it) => it.id));

export function isAdminTab(value: unknown): value is AdminTabId {
  return typeof value === 'string' && (ADMIN_TAB_IDS as string[]).includes(value);
}

export function adminNavItem(id: AdminTabId): AdminNavItem {
  return ADMIN_NAV.flatMap((g) => g.items).find((it) => it.id === id)!;
}

/** Badge on a nav item: `alert` = needs action (red), `info` = worth knowing (neutral). */
export type AdminBadge = { count: number; tone: 'alert' | 'info' };
export type AdminBadges = Partial<Record<AdminTabId, AdminBadge>>;

/** Extra URL params a deep link can carry (list filter, sub-filter). */
export type AdminNavParams = { q?: string; filter?: string };
export type AdminNavigate = (tab: AdminTabId, params?: AdminNavParams) => void;
