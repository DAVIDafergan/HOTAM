
/**
 * @fileOverview HOTAM Payment Webhook — Legacy Cloud Functions (DEPRECATED)
 *
 * This file is kept for reference only.
 * The Invoice4u webhook has been migrated to a Next.js API route:
 *   src/app/api/invoice4u/webhook/route.ts
 *
 * Configure Invoice4u callback URL to:
 *   https://hotam.shop/api/invoice4u/webhook
 *
 * If you still need to deploy a standalone webhook (e.g. on Cloud Run),
 * below is the Supabase-based equivalent using the service role key.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function handleInvoice4uWebhook(req, res) {
  try {
    const body = req.body || {};
    const ApiIdentifier = body.ApiIdentifier || req.query.ApiIdentifier;
    const Status = body.Status || req.query.Status;

    console.log('Invoice4u Webhook Triggered:', { ApiIdentifier, Status });

    if (Status === 'Success' && ApiIdentifier) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, verificationCode, buyerPhone')
        .eq('id', ApiIdentifier)
        .single();

      if (fetchError || !order) {
        console.error(`Order ${ApiIdentifier} not found`);
        return res.status(200).send('OK');
      }

      if (order.status !== 'pending_payment') {
        return res.status(200).send('Already processed');
      }

      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paidAt: new Date().toISOString(),
          invoiceGenerated: true,
          paymentProvider: 'invoice4u',
        })
        .eq('id', ApiIdentifier);

      console.log(
        `ORDER CONFIRMED: Order ${ApiIdentifier}. Code ${order.verificationCode} for buyer ${order.buyerPhone}`,
      );
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook Internal Error:', error);
    res.status(500).send('Internal Error');
  }
}

module.exports = { handleInvoice4uWebhook };

