
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { amount, productName, buyerName, buyerEmail, buyerPhone, orderId } = await req.json();
    
    // PayMe Seller ID (API Key provided by user)
    const PAYME_SELLER_ID = "12cd76ac-5ee8-4808-b43c-fb74bfddd9d0";
    
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
    
    if (data.status === 'success' || data.sale_url) {
      return NextResponse.json({ url: data.sale_url });
    } else {
      console.error('PayMe error details:', data);
      return NextResponse.json({ error: data.msg || 'Payment generation failed' }, { status: 400 });
    }
  } catch (error) {
    console.error('Internal API Error:', error);
    return NextResponse.json({ error: 'Internal server error during payment setup' }, { status: 500 });
  }
}
