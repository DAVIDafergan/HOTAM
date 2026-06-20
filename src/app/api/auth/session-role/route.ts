import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type ResolvedRole = 'customer' | 'seller' | 'admin' | null;

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 500 });
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. הגנה ראשונה: בדיקת המטא-דאטה קודם כל!
    const metadataRole = typeof user.user_metadata?.role === 'string' 
      ? user.user_metadata.role 
      : null;

    // אם המטא-דאטה מוגדרת כסופר או אדמין, נחזיר את זה מיד ולא נסתמך על הטבלאות שיש בהן כפילות
    if (metadataRole && ['admin', 'seller'].includes(metadataRole)) {
      return NextResponse.json({ role: metadataRole });
    }

    // 2. fallback: בדיקת הטבלאות במידה ואין תפקיד מוגדר במטא-דאטה
    const [{ data: adminRow }, { data: sellerRow }, { data: customerRow }] = await Promise.all([
      serviceClient.from('admins').select('id').eq('id', user.id).maybeSingle(),
      serviceClient.from('sellers').select('id').eq('id', user.id).maybeSingle(),
      serviceClient.from('customers').select('id').eq('id', user.id).maybeSingle(),
    ]);

    // סדר עדיפויות מוגן: אדמין -> סופר -> לקוח
    const role: ResolvedRole = adminRow
      ? 'admin'
      : sellerRow
        ? 'seller'
        : customerRow
          ? 'customer'
          : metadataRole === 'customer'
            ? 'customer'
            : null;

    return NextResponse.json({ role });
  } catch (error) {
    console.error('[auth/session-role] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
