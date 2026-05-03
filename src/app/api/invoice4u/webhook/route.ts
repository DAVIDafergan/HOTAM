
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Invoice4u success webhook — replaces the Firebase Cloud Function.
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

      // Fetch the order
      const { data: order, error: fetchError } = await supabase
        .from('orders')
        .select('status, verificationCode, buyerPhone')
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

      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          paidAt: new Date().toISOString(),
          invoiceGenerated: true,
          paymentProvider: 'invoice4u',
        })
        .eq('id', ApiIdentifier);

      if (updateError) {
        console.error('Order update failed:', updateError.message);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
      }

      console.log(
        `ORDER CONFIRMED: Order ${ApiIdentifier}. Code ${order.verificationCode} generated for buyer ${order.buyerPhone}`,
      );
    }

    return NextResponse.json({ message: 'OK' });
  } catch (error: any) {
    console.error('Webhook Internal Error:', error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
