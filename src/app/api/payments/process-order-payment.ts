import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';

const EMAIL_PRIMARY = '#1a1a2e';
const EMAIL_BACKGROUND = '#ffffff';
const EMAIL_SECTION_PADDING = '30px';
const EMAIL_PANEL_RADIUS = '16px';
const EMAIL_CODE_RADIUS = '12px';

export async function markOrderAsPaidAndNotify(orderId: string, paymentProvider: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('SERVICE ROLE KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'MISSING');
  console.log('SUPABASE URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'EXISTS' : 'MISSING');
  console.log('Looking for orderId:', orderId);

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment configuration');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  console.log('DB lookup orderId:', orderId);
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status, buyer_email, buyer_name, seller_id, product_id')
    .eq('id', orderId)
    .single();
  console.log('DB result:', JSON.stringify(order), 'error:', fetchError?.message);

  if (fetchError || !order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== 'pending_payment') {
    return { alreadyProcessed: true };
  }

  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

  const { error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      verification_code: verificationCode,
      paid_at: new Date().toISOString(),
      invoice_generated: true,
      payment_provider: paymentProvider,
    })
    .eq('id', orderId);

  if (updateError) {
    throw new Error(`Order update failed: ${updateError.message}`);
  }

  if (order.product_id) {
    const { data: product, error: productFetchError } = await supabase
      .from('products')
      .select('quantity')
      .eq('id', order.product_id)
      .single();

    if (!productFetchError && product) {
      const currentQuantity = Number(product.quantity || 0);
      if (currentQuantity <= 0) {
        console.warn(`Product ${order.product_id} quantity is already ${currentQuantity} while processing paid order ${orderId}`);
      } else {
        const nextQuantity = Math.max(0, currentQuantity - 1);
        const { error: productUpdateError } = await supabase
          .from('products')
          .update({ quantity: nextQuantity })
          .eq('id', order.product_id);
        if (productUpdateError) {
          console.error('Failed to decrement product quantity after payment:', productUpdateError.message);
        }
      }
    }
  }

  if (order.buyer_email) {
    sendEmail({
      to: order.buyer_email,
      subject: '✅ אישור הזמנה - הקוד הסודי שלך | Hotam Shop',
      text: `תודה על הרכישה שלך ב-Hotam Shop. המוכר יצור איתך קשר בהקדם לתיאום המסירה. הקוד הסודי שלך הוא ${verificationCode}. קבל את המוצר מהמוכר, בדוק שהוא תקין ומתאים למה שהזמנת, ורק לאחר מכן מסור למוכר את הקוד. אל תמסור את הקוד לפני שבדקת את המוצר.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${EMAIL_BACKGROUND}; color: #111827;">
          
          <div style="background: ${EMAIL_PRIMARY}; padding: ${EMAIL_SECTION_PADDING}; text-align: center;">
            <h1 style="color: ${EMAIL_BACKGROUND}; margin: 0; font-size: 28px; letter-spacing: 2px;">HOTAM</h1>
            <p style="color: #a0a0b0; margin: 5px 0 0;">שוק המוצרים המובחרים</p>
          </div>

          <div style="padding: 40px 30px;">
            <h2 style="color: ${EMAIL_PRIMARY}; margin-top: 0;">🎉 הרכישה בוצעה בהצלחה!</h2>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              תודה על הרכישה שלך ב-Hotam Shop.<br/>
              המוכר יצור איתך קשר בהקדם לתיאום המסירה.
            </p>

            <div style="background: #f0f4ff; border: 2px solid ${EMAIL_PRIMARY}; border-radius: ${EMAIL_PANEL_RADIUS}; padding: ${EMAIL_SECTION_PADDING}; text-align: center; margin: 30px 0;">
              <p style="color: ${EMAIL_PRIMARY}; font-size: 16px; font-weight: bold; margin: 0 0 15px;">🔐 הקוד הסודי שלך</p>
              <div style="background: ${EMAIL_PRIMARY}; color: ${EMAIL_BACKGROUND}; font-size: 42px; font-weight: bold; letter-spacing: 8px; padding: 20px; border-radius: ${EMAIL_CODE_RADIUS};">
                ${verificationCode}
              </div>
            </div>

            <div style="background: #fff8e1; border-right: 4px solid #f59e0b; padding: 20px; border-radius: ${EMAIL_CODE_RADIUS}; margin: 20px 0;">
              <p style="color: #92400e; font-weight: bold; margin: 0 0 10px;">⚠️ הוראות חשובות:</p>
              <ol style="color: #444; font-size: 15px; line-height: 2; margin: 0; padding-right: 20px;">
                <li>קבל את המוצר מהמוכר</li>
                <li>בדוק שהמוצר תקין ומתאים למה שהזמנת</li>
                <li>רק לאחר מכן — מסור למוכר את הקוד הסודי</li>
                <li>הקוד משחרר את התשלום למוכר</li>
              </ol>
            </div>

            <p style="color: #e11d48; font-weight: bold; font-size: 15px;">
              🚫 אל תמסור את הקוד לפני שבדקת את המוצר!
            </p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 13px; margin: 0;">
              Hotam Shop | כל הזכויות שמורות<br/>
              לשאלות ובירורים: support@hotam.shop
            </p>
          </div>
        </div>
      `,
    }).catch((err: Error) => console.error('Buyer email error:', err.message));
  }

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

  return { alreadyProcessed: false };
}
