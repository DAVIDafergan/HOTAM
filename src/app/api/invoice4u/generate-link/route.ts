
import { NextResponse } from 'next/server';

/**
 * Direct bridge to Invoice4u API.
 * This handles the secure communication with the clearing provider.
 */
export async function POST(req: Request) {
  try {
    const { orderId, amount, buyerName, buyerEmail, buyerPhone } = await req.json();
    
    // Using the provided API Key (GUID)
    const INVOICE4U_API_KEY = "12cd76ac-5ee8-4808-b43c-fb74bfddd9d0";

    const payload = {
      "ApiKey": INVOICE4U_API_KEY,
      "Document": {
        "Type": 6, // InvoiceOrder
        "Total": Number(amount),
        "Currency": "ILS",
        "ClientName": buyerName || "לקוח חותם",
        "ClientEmail": buyerEmail || "customer@hotam.co.il",
        "ClientPhone": buyerPhone || "",
        "ApiIdentifier": orderId, 
        "Items": [
          {
            "Name": "כלי קודש מהודר - חותם",
            "Price": Number(amount),
            "Quantity": 1
          }
        ]
      }
    };

    console.log("Initiating Invoice4u request for order:", orderId);

    const response = await fetch('https://api.invoice4u.co.il/Services/ApiService.svc/CreateDocument', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Invoice4u API Error:", errorText);
      return NextResponse.json({ error: "שגיאה בתקשורת מול ספק הסליקה" }, { status: 500 });
    }

    const data = await response.json();

    if (data && data.PaymentUrl) {
      return NextResponse.json({ url: data.PaymentUrl });
    } else {
      console.error("Invoice4u response missing URL:", data);
      return NextResponse.json({ error: "לא נוצר קישור תשלום" }, { status: 500 });
    }
  } catch (error: any) {
    console.error("Internal Payment Bridge Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
