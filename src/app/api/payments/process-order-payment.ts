import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/send-email';

export async function markOrderAsPaidAndNotify(orderId: string, paymentProvider: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment configuration');
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('status, buyer_email, buyer_name, seller_id, product_id')
    .eq('id', orderId)
    .single();

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
      subject: 'אישור הזמנה - הקוד הסודי שלך',
      text: `תתחדש! הרכישה בוצעה בהצלחה. כדי להגן על הכסף שלך, מסור למוכר את הקוד הבא **רק לאחר שקיבלת את המוצר ובדקת אותו**: ${verificationCode}`,
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
