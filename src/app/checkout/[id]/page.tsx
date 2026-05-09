
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import { useUser, useSupabaseClient, useDoc, useMemoStable } from '@/lib/supabase-hooks';
import { doc, serverTimestamp } from '@/lib/supabase-compat';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import unsplashLoader from '@/lib/unsplashLoader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Script from 'next/script';

declare global {
  interface Window {
    jQuery?: (callback: () => void) => void;
    OfficeGuy?: {
      Payments?: {
        BindFormSubmit: (config: {
          CompanyID?: string;
          APIPublicKey?: string;
        }) => void;
      };
    };
  }
}

// Helper to generate short alphanumeric ID
function generateShortId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

const MAX_SUMIT_BIND_ATTEMPTS = 50;
const SUMIT_BIND_RETRY_DELAY_MS = 200;
const PAYMENT_SUCCESS_REDIRECT_DELAY_MS = 800;

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
  const [isSumitReady, setIsSumitReady] = useState(false);
  const [sumitError, setSumitError] = useState<string | null>(null);
  
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingOrderRef = useRef<{ orderId: string; verificationCode: string } | null>(null);
  const chargeInFlightRef = useRef(false);
  const sumitBindRef = useRef(false);

  // Keep supporting the legacy SUMMIT_* client env names until deployment config is normalized.
  const sumitCompanyId = process.env.NEXT_PUBLIC_SUMIT_BUSINESS_ID || process.env.NEXT_PUBLIC_SUMMIT_BUSINESS_ID;
  const sumitPublicKey = process.env.NEXT_PUBLIC_SUMIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_SUMMIT_PUBLIC_KEY;

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
    setDeliveryChoice((prev) => {
      if (!prev) return canShip ? 'shipping' : 'pickup';
      if (prev === 'shipping' && !canShip) return canPickup ? 'pickup' : '';
      if (prev === 'pickup' && !canPickup) return canShip ? 'shipping' : '';
      return prev;
    });
  }, [product, canShip, canPickup]);

  useEffect(() => {
    pendingOrderRef.current = null;
  }, [deliveryChoice, recipientName, recipientPhone, recipientAddress, recipientCity, totalPrice, productId, user?.uid]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!sumitCompanyId || !sumitPublicKey) {
      setSumitError('חסרים פרטי הזדהות של מערכת הסליקה.');
      return;
    }
    if (sumitBindRef.current) {
      setIsSumitReady(true);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const tryBind = () => {
      if (cancelled || sumitBindRef.current) return;

      if (!window.jQuery || !window.OfficeGuy?.Payments?.BindFormSubmit) {
        attempts += 1;
        if (attempts >= MAX_SUMIT_BIND_ATTEMPTS) {
          setSumitError('מערכת הסליקה לא נטענה. נסו לרענן את העמוד.');
          return;
        }
        timeoutId = setTimeout(tryBind, SUMIT_BIND_RETRY_DELAY_MS);
        return;
      }

      window.jQuery(function() {
        if (cancelled || sumitBindRef.current) return;
        window.OfficeGuy?.Payments?.BindFormSubmit({
          CompanyID: sumitCompanyId,
          APIPublicKey: sumitPublicKey,
        });
        sumitBindRef.current = true;
        setIsSumitReady(true);
        setSumitError(null);
      });
    };

    tryBind();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sumitCompanyId, sumitPublicKey]);

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const validateCheckout = useCallback(() => {
    if (!recipientName || !recipientPhone || (deliveryChoice === 'shipping' && (!recipientAddress || !recipientCity))) {
      return 'אנא מלא את כל פרטי החובה למשלוח.';
    }

    if (deliveryChoice === 'shipping' && allowedCities.length > 0 && !allowedCities.includes('כל הארץ') && !allowedCities.includes(recipientCity)) {
      return 'הסופר אינו מבצע משלוחים לעיר זו.';
    }
    
    return null;
  }, [allowedCities, deliveryChoice, recipientAddress, recipientCity, recipientName, recipientPhone]);

  const upsertPendingOrder = useCallback(async () => {
    const existingOrder = pendingOrderRef.current;
    const shortId = existingOrder?.orderId || generateShortId(10);
    const vCode = existingOrder?.verificationCode || generateVerificationCode();

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

    const { error } = await db.from('orders').upsert(orderData, { onConflict: 'id' });

    if (error) {
      throw new Error(error.message || 'לא ניתן היה לשמור את פרטי ההזמנה.');
    }

    pendingOrderRef.current = { orderId: shortId, verificationCode: vCode };
    return shortId;
  }, [db, deliveryChoice, product, productId, recipientAddress, recipientCity, recipientName, recipientPhone, totalPrice, user?.email, user?.uid]);

  const extractOgToken = (form: HTMLFormElement) => {
    // SUMIT injects `og-token`; the data-og selector is kept as a defensive fallback.
    const namedToken = form.querySelector('input[name="og-token"]') as HTMLInputElement | null;
    const tokenField = namedToken || (form.querySelector('input[data-og="token"]') as HTMLInputElement | null);
    return tokenField?.value?.trim() || '';
  };

  const handleStartPayment = async () => {
    const validationError = validateCheckout();
    if (validationError) {
      toast({ variant: "destructive", title: "פרטים חסרים", description: validationError });
      return;
    }

    if (!isSumitReady || !sumitCompanyId || !sumitPublicKey) {
      toast({ variant: "destructive", title: "מערכת הסליקה לא מוכנה", description: sumitError || 'נסו שוב בעוד רגע.' });
      return;
    }

    try {
      await upsertPendingOrder();
      formRef.current?.requestSubmit();
    } catch (err: any) {
      console.error('Payment Preparation Error:', err);
      toast({ variant: "destructive", title: "שגיאת תשלום", description: err.message || "חלה שגיאה בחיבור למערכת הסליקה." });
    }
  };

  const handlePaymentFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    const validationError = validateCheckout();
    if (validationError) {
      event.preventDefault();
      toast({ variant: "destructive", title: "פרטים חסרים", description: validationError });
      return;
    }

    const token = extractOgToken(event.currentTarget);
    if (!token) {
      const tokenizationError = event.currentTarget.querySelector('.og-errors')?.textContent?.trim();
      if (tokenizationError) {
        toast({ variant: "destructive", title: "פרטי התשלום אינם תקינים", description: tokenizationError });
      }
      return;
    }

    event.preventDefault();

    if (chargeInFlightRef.current) {
      return;
    }

    chargeInFlightRef.current = true;
    setIsProcessing(true);

    try {
      const orderId = await upsertPendingOrder();
      const response = await fetch('/api/payments/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          token,
          price: totalPrice,
          productName: product.product_name || product.product_type || 'מוצר קודש',
          customerEmail: user?.email,
          customerPhone: recipientPhone
        })
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data.error || 'לא ניתן היה להשלים את החיוב.');
      }

      setIsSuccess(true);
      toast({ title: "התשלום הושלם", description: "ההזמנה אושרה בהצלחה." });
      setTimeout(() => {
        router.push(`/customer/dashboard?payment=success&orderId=${encodeURIComponent(orderId)}`);
      }, PAYMENT_SUCCESS_REDIRECT_DELAY_MS);
    } catch (err: any) {
      console.error('Payment Charge Error:', err);
      toast({ variant: "destructive", title: "שגיאת תשלום", description: err.message || "חלה שגיאה בחיבור למערכת הסליקה." });
    } finally {
      chargeInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  if (isUserLoading || isProductLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  if (!user || !product) return null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20 text-right" dir="rtl">
      <Script
        src="https://code.jquery.com/jquery-3.7.1.min.js"
        strategy="beforeInteractive"
        integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo="
        crossOrigin="anonymous"
      />
      {/* SUMIT does not publish a stable SRI hash for this hosted script, so it is loaded by origin only. */}
      <Script src="https://app.sumit.co.il/scripts/payments.js" strategy="beforeInteractive" crossOrigin="anonymous" />
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
                          ) : allowedCities.map((city: string) => (<SelectItem key={city} value={city}>{city}</SelectItem>))}
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

              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h3 className="text-xl font-black">פרטי תשלום</h3>
                  <CreditCard className="w-6 h-6 text-accent" />
                </div>

                <form ref={formRef} data-og="form" method="post" className="space-y-4" onSubmit={handlePaymentFormSubmit}>
                  <div className="og-errors rounded-2xl bg-destructive/10 text-destructive text-sm font-bold empty:hidden px-4 py-3" />

                  <div className="space-y-2">
                    <Label htmlFor="sumit-card-number">מספר כרטיס</Label>
                    <Input id="sumit-card-number" name="cardnumber" type="text" inputMode="numeric" autoComplete="cc-number" maxLength={20} data-og="cardnumber" required className="text-left h-12 rounded-xl" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sumit-expiration-month">חודש</Label>
                      <Input id="sumit-expiration-month" name="expirationmonth" type="text" inputMode="numeric" autoComplete="cc-exp-month" maxLength={2} data-og="expirationmonth" required className="text-left h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sumit-expiration-year">שנה</Label>
                      <Input id="sumit-expiration-year" name="expirationyear" type="text" inputMode="numeric" autoComplete="cc-exp-year" maxLength={4} data-og="expirationyear" required className="text-left h-12 rounded-xl" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sumit-cvv">CVV</Label>
                      <Input id="sumit-cvv" name="cvv" type="password" inputMode="numeric" autoComplete="cc-csc" maxLength={4} data-og="cvv" required className="text-left h-12 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sumit-citizen-id">תעודת זהות</Label>
                      <Input id="sumit-citizen-id" name="citizenid" type="text" inputMode="numeric" maxLength={9} data-og="citizenid" required className="text-left h-12 rounded-xl" />
                    </div>
                  </div>

                  {sumitError ? (
                    <div className="flex items-start gap-2 rounded-2xl bg-amber-50 text-amber-700 px-4 py-3 text-sm font-bold">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{sumitError}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground font-bold">
                      {!isSumitReady ? 'מערכת הסליקה נטענת...' : 'פרטי האשראי נשארים בטופס המאובטח של SUMIT.'}
                    </div>
                  )}
                </form>

                <div className="pt-2">
                  <Button
                    type="button"
                    onClick={handleStartPayment}
                    disabled={isProcessing || !deliveryChoice || !isSumitReady}
                    className="w-full bg-primary text-white hover:bg-primary/90 h-16 rounded-2xl shadow-xl font-black text-xl uppercase tracking-widest gap-3"
                  >
                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <CreditCard className="w-6 h-6" />}
                    בצע תשלום מאובטח - ₪{totalPrice}
                  </Button>
                </div>
              </Card>
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
        ) : (
          <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-10 text-center max-w-xl mx-auto">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="w-16 h-16 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-black text-primary mb-2">התשלום התקבל בהצלחה</h1>
            <p className="text-muted-foreground font-bold">מעבירים אותך לאיזור האישי...</p>
          </Card>
        )}
      </main>
    </div>
  );
}
