
/**
 * @fileOverview Cloud Functions for HOTAM - Payment Webhooks and Marketplace Escrow
 */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Webhook receiver for Invoice4u success signals.
 * Marketplace Flow: Updates order to 'paid' (funds held).
 */
exports.invoice4uWebhook = onRequest(async (req, res) => {
  try {
    const body = req.body || {};
    const ApiIdentifier = body.ApiIdentifier || req.query.ApiIdentifier;
    const Status = body.Status || req.query.Status;

    console.log("Invoice4u Webhook Triggered:", { ApiIdentifier, Status });

    if (Status === "Success" && ApiIdentifier) {
      const orderRef = admin.firestore().collection("orders").doc(ApiIdentifier);
      const orderSnap = await orderRef.get();
      
      if (orderSnap.exists()) {
        const orderData = orderSnap.data();
        
        // Prevent double processing
        if (orderData.status !== 'pending_payment') {
          return res.status(200).send("Already processed");
        }

        // Marketplace Held Status: 'paid' means money is frozen at clearing provider
        await orderRef.update({
          status: "paid",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          invoiceGenerated: true,
          paymentProvider: "invoice4u"
        });

        // SIMULATION: Sending SMS to customer with the code
        console.log(`ORDER CONFIRMED: Order ${ApiIdentifier}. Code ${orderData.verificationCode} generated for buyer ${orderData.buyerPhone}`);
      } else {
        console.error(`Order ${ApiIdentifier} not found in Firestore`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook Internal Error:", error);
    res.status(500).send("Internal Error");
  }
});
