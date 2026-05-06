
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';

/**
 * Invoice4u success webhook — server-side route handler.
 * Updates the order to 'paid' (marketplace escrow) when payment succeeds.
 *
 * Configure the Invoice4u callback URL to:
 *   https://hotam.shop/api/invoice4u/webhook
 */
export async function POST(req: Request) {
  return handleWebhook(req);
}

export async function GET(req: Request) {
  return handleWebhook(req);
}

async function handleWebhook(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Support both JSON body and URL query params
    let ApiIdentifier: string | null = null;
    let Status: string | null = null;

    const url = new URL(req.url);
    ApiIdentifier = url.searchParams.get('ApiIdentifier');
    Status = url.searchParams.get('Status');

    if (req.method === 'POST') {
      try {
        const body = await req.json();
        ApiIdentifier = body.ApiIdentifier ?? ApiIdentifier;
        Status = body.Status ?? Status;
      } catch {
        // body might be empty
      }
    }

    console.log('Invoice4u Webhook Triggered:', { ApiIdentifier, Status });

    if (Status === 'Success' && ApiIdentifier) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);

      // Fetch the order with buyer/seller info
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, buyer_email, buyer_name, seller_id')
        .eq('id', ApiIdentifier)
        .single();

      if (fetchError || !order) {
        console.error(`Order ${ApiIdentifier} not found:`, fetchError?.message);
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Prevent double processing
      if (order.status !== 'pending_payment') {
        return NextResponse.json({ message: 'Already processed' });
      }

      // Generate a 6-digit verification code
      const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'pending_delivery',
          verification_code: verificationCode,
          paid_at: new Date().toISOString(),
          invoice_generated: true,
          payment_provider: 'invoice4u',
        })
        .eq('id', ApiIdentifier);

      if (updateError) {
        console.error('Order update failed:', updateError.message);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
      }

      console.log(`ORDER CONFIRMED: Order ${ApiIdentifier}. Verification code ${verificationCode} generated for buyer ${order.buyer_email}`);

      // Send confirmation email to buyer
      if (order.buyer_email) {
        sendEmail({
          to: order.buyer_email,
          subject: 'אישור הזמנה - הקוד הסודי שלך',
          text: `תתחדש! הרכישה בוצעה בהצלחה. כדי להגן על הכסף שלך, מסור למוכר את הקוד הבא **רק לאחר שקיבלת את המוצר ובדקת אותו**: ${verificationCode}`,
        }).catch((err: Error) => console.error('Buyer email error:', err.message));
      }

      // Fetch seller email and send notification
      if (order.seller_id) {
        const { data: seller } = await supabase
          .from('sellers')
          .select('email')
          .eq('id', order.seller_id)
          .single();
        if (seller?.email) {
          const buyerName = order.buyer_name || 'קונה';
          sendEmail({
            to: seller.email,
            subject: 'יש לך מכירה חדשה! (Hotam Shop)',
            text: `מזל טוב, המוצר שלך נמכר! פרטי הקונה: ${buyerName}. שים לב: הכסף יועבר אליך רק לאחר שתמסור את המוצר ותזין במערכת את 6 הספרות שתקבל מהקונה במעמד המסירה.`,
          }).catch((err: Error) => console.error('Seller email error:', err.message));
        }
      }
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error: any) {
    console.error('Webhook Internal Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
