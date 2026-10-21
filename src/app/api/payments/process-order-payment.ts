import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';
import { afterResponse, notifyUser, shortSite } from '@/lib/notify-channels';

const EMAIL_PRIMARY = '#1a1a2e';
const EMAIL_BACKGROUND = '#ffffff';
const EMAIL_TEXT_COLOR = '#111827';
const EMAIL_SECTION_PADDING = '30px';
const EMAIL_PANEL_RADIUS = '16px';
const EMAIL_CODE_RADIUS = '12px';

export async function markOrderAsPaidAndNotify(orderId: string, paymentProvider: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment configuration');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status, buyer_id, buyer_email, buyer_name, seller_id, product_id')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.status !== 'pending_payment') {
    return { alreadyProcessed: true };
  }

  const verificationCode = String(Math.floor(100000 + Math.random() * 900000));

  // Only the request that actually moves the order out of pending_payment continues (the payment
  // webhook and the charge route can run at the same time): no double emails, SMS or calls, and
  // no second secret code.
  const { data: updatedRows, error: updateError } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      verification_code: verificationCode,
      paid_at: new Date().toISOString(),
      invoice_generated: true,
      payment_provider: paymentProvider,
    })
    .eq('id', orderId)
    .eq('status', 'pending_payment')
    .select('id');

  if (updateError) {
    throw new Error(`Order update failed: ${updateError.message}`);
  }
  if (!updatedRows || updatedRows.length === 0) {
    return { alreadyProcessed: true };
  }

  let productTypeForSellerEmail = 'מוצר קודש';

  if (order.product_id) {
    const { data: product, error: productFetchError } = await supabase
      .from('products')
      .select('quantity, product_type')
      .eq('id', order.product_id)
      .single();

    if (!productFetchError && product) {
      productTypeForSellerEmail = product.product_type || productTypeForSellerEmail;
      const { data: decrementedQuantity, error: productUpdateError } = await supabase
        .rpc('decrement_product_quantity', { product_id: order.product_id });
      if (productUpdateError) {
        console.error('Failed to decrement product quantity after payment:', productUpdateError.message);
      } else if (decrementedQuantity == null) {
        console.warn(`[payment] Concurrent purchase detected for product ${order.product_id}, quantity not decremented`);
      }
    }
  }

  if (order.buyer_email) {
    await sendEmail({
      to: order.buyer_email,
      subject: '✅ אישור הזמנה - הקוד הסודי שלך | Hotam Shop',
      text: `תודה על הרכישה שלך ב-Hotam Shop. המוכר יצור איתך קשר בהקדם לתיאום המסירה. הקוד הסודי שלך הוא ${verificationCode}. קבל את המוצר מהמוכר, בדוק שהוא תקין ומתאים למה שהזמנת, ורק לאחר מכן מסור למוכר את הקוד. אל תמסור את הקוד לפני שבדקת את המוצר.`,
      html: `
        <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${EMAIL_BACKGROUND}; color: ${EMAIL_TEXT_COLOR};">
          
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

  // SMS / call copies (only for buyers who switched them on). The secret code stays in the email
  // and the personal area: it is not sent by SMS or read out in a call.
  if (order.buyer_id) {
    afterResponse(() => notifyUser({
      userId: String(order.buyer_id),
      kind: 'order_paid_buyer',
      service: supabase,
      message: {
        sms: 'חותם: ההזמנה אושרה! המוכר ייצור קשר לתיאום. הקוד הסודי במייל - מוסרים אותו רק אחרי בדיקת המוצר.',
        voice: 'התשלום על ההזמנה שלך התקבל וההזמנה אושרה. המוכר ייצור איתך קשר לתיאום המסירה. הקוד הסודי נשלח אליך במייל ומופיע גם באזור האישי. חשוב: מוסרים את הקוד למוכר רק אחרי שבדקת את המוצר.',
      },
    }));
  }

  if (order.seller_id) {
    const { data: seller } = await supabase
      .from('sellers')
      .select('email')
      .eq('id', order.seller_id)
      .single();

    if (seller?.email) {
      const buyerName = order.buyer_name || 'קונה';
      await sendEmail({
        to: seller.email,
        subject: `🎉 מכירה חדשה! ${productTypeForSellerEmail} — Hotam Shop`,
        text: `מזל טוב, יש לך מכירה חדשה מסוג ${productTypeForSellerEmail}. פרטי הקונה נמצאים בדשבורד, בתוך ההזמנה הספציפית. הכסף יועבר אליך לאחר מסירת המוצר וקבלת קוד האימות מהקונה. לניהול ההזמנה: https://hotam.shop/seller/dashboard`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: ${EMAIL_BACKGROUND}; color: ${EMAIL_TEXT_COLOR};">
            <div style="background: ${EMAIL_PRIMARY}; padding: ${EMAIL_SECTION_PADDING}; text-align: center;">
              <h1 style="color: ${EMAIL_BACKGROUND}; margin: 0; font-size: 28px; letter-spacing: 2px;">HOTAM</h1>
              <p style="color: #a0a0b0; margin: 5px 0 0;">שוק המוצרים המובחרים</p>
            </div>

            <div style="padding: 40px 30px;">
              <h2 style="color: ${EMAIL_PRIMARY}; margin-top: 0;">🎉 מכירה חדשה התקבלה!</h2>
              <p style="color: #444; font-size: 16px; line-height: 1.8; margin: 0 0 16px;">
                קיבלת הזמנה חדשה עבור <strong>${productTypeForSellerEmail}</strong>.
              </p>
              <p style="color: #444; font-size: 16px; line-height: 1.8; margin: 0 0 20px;">
                פרטי הקונה נמצאים בדשבורד, בתוך ההזמנה הספציפית.
              </p>

              <div style="background: #fff8e1; border-right: 4px solid #f59e0b; padding: 20px; border-radius: ${EMAIL_CODE_RADIUS}; margin: 20px 0;">
                <p style="color: #92400e; font-weight: bold; margin: 0; line-height: 1.8;">
                  הכסף יועבר אליך לאחר מסירת המוצר וקבלת קוד האימות מהקונה.
                </p>
              </div>

              <div style="text-align: center; margin: 30px 0 10px;">
                <a href="https://hotam.shop/seller/dashboard" style="display: inline-block; background: ${EMAIL_PRIMARY}; color: ${EMAIL_BACKGROUND}; text-decoration: none; padding: 14px 30px; border-radius: 999px; font-weight: bold;">
                  מעבר לדשבורד המוכר
                </a>
              </div>
            </div>

            <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 13px; margin: 0;">
                Hotam Shop | כל הזכויות שמורות<br/>
                לשאלות ובירורים: support@hotam.shop
              </p>
            </div>
          </div>
        `,
      }).catch((err: Error) => console.error('Seller email error:', err.message));
    }

    afterResponse(() => notifyUser({
      userId: String(order.seller_id),
      kind: 'order_paid_seller',
      service: supabase,
      message: {
        sms: `חותם: מכירה חדשה (${productTypeForSellerEmail})! הפרטים בדשבורד: ${shortSite()}/seller/dashboard`,
        voice: `מזל טוב, יש לך מכירה חדשה באתר חותם: ${productTypeForSellerEmail}. פרטי הקונה נמצאים בדשבורד המוכר, בתוך ההזמנה. הכסף יועבר אליך לאחר המסירה וקבלת קוד האימות מהקונה.`,
      },
    }));
  }

  return { alreadyProcessed: false };
}
