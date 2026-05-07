
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Truck, 
  MapPin, 
  User, 
  Loader2, 
  CheckCircle2, 
  CreditCard, 
  AlertCircle
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useSupabaseClient, useDoc, useMemoStable, setDocumentNonBlocking } from '@/lib/supabase-hooks';
import { doc, serverTimestamp } from '@/lib/supabase-compat';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Helper to generate short alphanumeric ID
function generateShortId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function CheckoutPage() {
  const params = useParams();
  const productId = params?.id as string;
  const { user, isUserLoading } = useUser();
  const db = useSupabaseClient();
  const router = useRouter();
  const { toast } = useToast();

  const [deliveryChoice, setDeliveryChoice] = useState(''); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');

  const productRef = useMemoStable(() => productId ? doc(db, 'products', productId) : null, [db, productId]);
  const { data: product, isLoading: isProductLoading } = useDoc<any>(productRef);

  const customerRef = useMemoStable(() => user ? doc(db, 'customers', user.uid) : null, [db, user?.uid]);
  const { data: customer } = useDoc<any>(customerRef);

  useEffect(() => {
    if (customer) {
      setRecipientName(`${customer.first_name || ''} ${customer.last_name || ''}`);
      setRecipientPhone(customer.phone || '');
      setRecipientAddress(customer.address || '');
    }
  }, [customer]);

  const basePrice = useMemo(() => Number(product?.price || 0), [product]);
  const vatAmount = useMemo(() => Math.round(basePrice * 0.18), [basePrice]);
  const baseWithVat = useMemo(() => basePrice + vatAmount, [basePrice, vatAmount]);
  
  const totalPrice = useMemo(() => {
    const delivery = deliveryChoice === 'shipping' ? (Number(product?.delivery_fee) || 0) : 0;
    return baseWithVat + delivery;
  }, [baseWithVat, deliveryChoice, product?.delivery_fee]);

  const allowedCities = useMemo(() => {
    if (!product?.delivery_area) return [];
    return Array.isArray(product.delivery_area) ? product.delivery_area : [product.delivery_area];
  }, [product]);

  const normalizedDeliveryType = useMemo(() => {
    const raw = String(product?.delivery_type || '').toLowerCase();
    if (raw === 'shipping' || raw === 'shipping_only') return 'shipping';
    if (raw === 'pickup' || raw === 'pickup_only') return 'pickup';
    return 'both';
  }, [product?.delivery_type]);

  const canShip = normalizedDeliveryType === 'shipping' || normalizedDeliveryType === 'both';
  const canPickup = normalizedDeliveryType === 'pickup' || normalizedDeliveryType === 'both';

  useEffect(() => {
    if (!product) return;
    if (!deliveryChoice) {
      setDeliveryChoice(canShip ? 'shipping' : 'pickup');
      return;
    }
    if (deliveryChoice === 'shipping' && !canShip) {
      setDeliveryChoice(canPickup ? 'pickup' : '');
    }
    if (deliveryChoice === 'pickup' && !canPickup) {
      setDeliveryChoice(canShip ? 'shipping' : '');
    }
  }, [product, canShip, canPickup, deliveryChoice]);

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const handleConfirmOrder = async () => {
    if (!recipientName || !recipientPhone || (deliveryChoice === 'shipping' && (!recipientAddress || !recipientCity))) {
      toast({ variant: "destructive", title: "פרטים חסרים", description: "אנא מלא את כל פרטי החובה למשלוח." });
      return;
    }

    if (deliveryChoice === 'shipping' && allowedCities.length > 0 && !allowedCities.includes('כל הארץ') && !allowedCities.includes(recipientCity)) {
      toast({ variant: "destructive", title: "עיר לא נתמכת", description: "הסופר אינו מבצע משלוחים לעיר זו." });
      return;
    }

    setIsProcessing(true);
    
    // Generate a shorter display ID
    const shortId = generateShortId(10);
    const vCode = generateVerificationCode();

    const orderData = {
      id: shortId,
      buyer_id: user?.uid,
      buyer_name: recipientName,
      buyer_phone: recipientPhone,
      buyer_email: user?.email || '',
      buyer_address: deliveryChoice === 'shipping' ? `${recipientAddress}, ${recipientCity}` : 'איסוף עצמי',
      seller_id: product.seller_id,
      product_id: productId,
      product_name: product.product_type,
      product_image: product.images?.[0] || '',
      amount: totalPrice,
      delivery_method: deliveryChoice === 'shipping' ? 'משלוח' : 'איסוף עצמי',
      status: 'pending_payment',
      verification_code: vCode,
      is_rated: false,
      created_at: serverTimestamp()
    };

    try {
      // Use the short ID as the document ID
      setDocumentNonBlocking(doc(db, 'orders', shortId), orderData, { merge: true });
      
      const response = await fetch('/api/payments/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: shortId,
          amount: totalPrice,
          productName: product.product_name || product.product_type || 'מוצר קודש',
          currency: 'ILS',
          buyerName: recipientName,
          buyerEmail: user?.email,
          buyerPhone: recipientPhone
        })
      });

      const data = await response.json();
      
      if (data.paymentUrl || data.PaymentURL || data.url) {
        window.location.href = data.paymentUrl || data.PaymentURL || data.url;
      } else {
        throw new Error(data.error || 'לא ניתן היה ליצור קישור לתשלום.');
      }
    } catch (err: any) {
      console.error('Payment Flow Error:', err);
      toast({ variant: "destructive", title: "שגיאת תשלום", description: err.message || "חלה שגיאה בחיבור למערכת הסליקה." });
      setIsProcessing(false);
    }
  };

  if (isUserLoading || isProductLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!user || !product) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 text-right" dir="rtl">
      <Navbar />

      <main className="container mx-auto px-4 py-20 md:py-28 max-w-4xl">
        {!isSuccess ? (
          <div className="grid md:grid-cols-5 gap-6">
            <div className="md:col-span-3 space-y-6">
              <h1 className="text-3xl font-headline font-black text-primary">סיכום הזמנה ותשלום</h1>

              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="text-xl font-black">פרטי התקשרות</h3>
                  <User className="w-6 h-6 text-accent" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>שם מלא *</Label><Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="text-right h-12 rounded-xl" /></div>
                  <div className="space-y-2"><Label>טלפון לקבלת קוד אימות *</Label><Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="text-right h-12 rounded-xl" placeholder="למשל: 0501234567" /></div>
                </div>
              </Card>

              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="text-xl font-black">אופן קבלת המוצר</h3>
                  <Truck className="w-6 h-6 text-accent" />
                </div>
                <RadioGroup value={deliveryChoice} onValueChange={setDeliveryChoice} className="grid gap-4">
                  <Label htmlFor="delivery" className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${deliveryChoice === 'shipping' ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                      <Truck className="w-5 h-5 text-primary" />
                      <div className="text-right">
                        <span className="font-black text-primary block">משלוח</span>
                        <span className="text-xs text-muted-foreground">עד הבית (+₪{product.delivery_fee || 0})</span>
                      </div>
                    </div>
                    <RadioGroupItem value="shipping" id="delivery" disabled={!canShip} />
                  </Label>
                  <Label htmlFor="pickup" className={`flex items-center justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all ${deliveryChoice === 'pickup' ? 'border-primary bg-primary/5' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                      <MapPin className="w-5 h-5 text-primary" />
                      <div className="text-right">
                        <span className="font-black text-primary block">איסוף עצמי</span>
                        <span className="text-xs text-muted-foreground">בתיאום מול הסופר (חינם)</span>
                      </div>
                    </div>
                    <RadioGroupItem value="pickup" id="pickup" disabled={!canPickup} />
                  </Label>
                </RadioGroup>

                {deliveryChoice === 'shipping' && (
                  <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>עיר למשלוח *</Label>
                      <Select value={recipientCity} onValueChange={setRecipientCity}>
                        <SelectTrigger className="text-right h-12 rounded-xl"><SelectValue placeholder="בחר עיר מתוך רשימת המוכר..." /></SelectTrigger>
                        <SelectContent>
                          {allowedCities.includes('כל הארץ') ? (
                             <SelectItem value="כל הארץ">כל הארץ</SelectItem>
                          ) : allowedCities.map(city => (<SelectItem key={city} value={city}>{city}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>כתובת מלאה *</Label>
                      <div className="relative"><Input placeholder="רחוב, מספר בית, דירה..." value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="text-right pr-10 h-12 rounded-xl" /><MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /></div>
                    </div>
                  </div>
                )}
              </Card>

              <div className="pt-4">
                <Button onClick={handleConfirmOrder} disabled={isProcessing || !deliveryChoice} className="w-full bg-primary text-white hover:bg-primary/90 h-16 rounded-2xl shadow-xl font-black text-xl uppercase tracking-widest gap-3">
                  {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
                  בצע תשלום מאובטח - ₪{totalPrice}
                </Button>
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-6">
              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-6 sticky top-32">
                <h3 className="font-black text-primary border-b pb-3 mb-4">סיכום הזמנה</h3>
                <div className="flex gap-4 items-center mb-6">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border shrink-0"><Image loader={unsplashLoader} src={product.images?.[0] || '/hotam-logo.png'} alt="product" fill className="object-cover" /></div>
                  <div className="text-right"><p className="font-black text-sm">{product.product_type}</p><p className="text-[10px] text-muted-foreground font-bold">{product.script_type}</p></div>
                </div>
                <div className="space-y-3 border-t pt-4">
                  <div className="flex justify-between text-xs font-bold">
                    <span>₪{basePrice}</span>
                    <span className="text-muted-foreground">מחיר סופר</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-600 font-bold">
                    <span>₪{vatAmount}</span>
                    <span className="text-muted-foreground">מע"מ (18%)</span>
                  </div>
                  {deliveryChoice === 'shipping' && (
                    <div className="flex justify-between text-xs font-bold">
                      <span>₪{product.delivery_fee || 0}</span>
                      <span className="text-muted-foreground">דמי משלוח</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-black border-t pt-3 mt-3">
                    <span className="text-primary">₪{totalPrice}</span>
                    <span className="text-primary">סה"כ לתשלום</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
