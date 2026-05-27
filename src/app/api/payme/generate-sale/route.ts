
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { createClient } = await import('@supabase/supabase-js');
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productName, buyerName, buyerEmail, buyerPhone, orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
    }

    const PAYME_SELLER_ID = process.env.PAYME_SELLER_ID;
    if (!PAYME_SELLER_ID) {
      console.error('[payme] PAYME_SELLER_ID env var is not set');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 500 });
    }
    
    const { data: orderRow, error: orderError } = await serviceClient
      .from('orders')
      .select('amount, status, buyer_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (orderRow.buyer_id && orderRow.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (orderRow.status !== 'pending_payment') {
      return NextResponse.json({ error: 'Order already processed' }, { status: 400 });
    }

    const amount = Number(orderRow.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid order amount' }, { status: 400 });
    }

    // Using PayMe NG API endpoint
    const response = await fetch('https://ng.payme.io/api/generate-sale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seller_payme_id: PAYME_SELLER_ID,
        sale_price: Math.round(Number(amount) * 100), // convert to agurot (cents)
        currency: "ILS",
        product_name: productName || "מוצר קודש",
        installments: "1",
        language: "he",
        buyer_name: buyerName,
        buyer_email: buyerEmail || "customer@hotam.co.il",
        buyer_phone: buyerPhone,
        extra_details: orderId, // Our internal order reference
        capture: true // Automatically capture the payment
      })
    });

    const data = await response.json();
    
    if (response.ok && (data.status === 'success' || data.sale_url)) {
      return NextResponse.json({ url: data.sale_url });
    } else {
      console.error('PayMe error details:', data);
      return NextResponse.json({ error: 'יצירת התשלום נכשלה. אנא נסה שוב.' }, { status: response.ok ? 400 : response.status });
    }
  } catch (error) {
    console.error('Internal API Error:', error);
    return NextResponse.json({ error: 'Internal server error during payment setup' }, { status: 500 });
  }
}
