
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
import { geocodeAddressWithGoogle, getCityFromAddressComponents, loadGoogleMapsPlacesScript } from '@/lib/google-maps';


declare global {
  interface Window {
    jQuery?: (callback: () => void) => void;
    OfficeGuy?: {
      Payments?: {
        BindFormSubmit: (config: {
          CompanyID?: string;
          APIPublicKey?: string;
          Callback?: (token: string | null) => void | Promise<void>;
        }) => void;
        CreateToken: (config: {
          CompanyID: string;
          APIPublicKey: string;
          FormSelector: string;
          Callback: (token: string | null) => void | Promise<void>;
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

const FALLBACK_PRODUCT_DESCRIPTION = 'מוצר';
const JQUERY_SCRIPT_SELECTOR = 'script[data-hotam="jquery"]';
const SUMIT_SCRIPT_SELECTOR = 'script[data-hotam="sumit"]';
const SUMIT_READY_POLL_INTERVAL_MS = 250;
const SUMIT_READY_POLL_ATTEMPTS = 20;
// Keep supporting legacy SUMMIT_* client env names until deployment config is normalized.
const SUMIT_COMPANY_ID = process.env.NEXT_PUBLIC_SUMIT_BUSINESS_ID || process.env.NEXT_PUBLIC_SUMMIT_BUSINESS_ID || '';
const SUMIT_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUMIT_PUBLIC_KEY || process.env.NEXT_PUBLIC_SUMMIT_PUBLIC_KEY || '';
let sumitLoadPromise: Promise<void> | null = null;

function pollReady(resolve: () => void, reject: (e: Error) => void) {
  let attempts = 0;
  const poll = () => {
    if ((window as any).OfficeGuy?.Payments?.BindFormSubmit) {
      resolve();
      return;
    }

    if (++attempts < SUMIT_READY_POLL_ATTEMPTS) {
      setTimeout(poll, SUMIT_READY_POLL_INTERVAL_MS);
    } else {
      reject(new Error('OfficeGuy לא נטען'));
    }
  };

  poll();
}

function loadSumitScripts(): Promise<void> {
  if (sumitLoadPromise) return sumitLoadPromise;

  sumitLoadPromise = new Promise<void>((resolve, reject) => {
    const injectSumit = () => {
      if (document.querySelector(SUMIT_SCRIPT_SELECTOR)) {
        pollReady(resolve, reject);
        return;
      }

      const s = document.createElement('script');
      s.src = 'https://app.sumit.co.il/scripts/payments.js';
      s.async = true;
      s.dataset.hotam = 'sumit';
      s.onload = () => pollReady(resolve, reject);
      s.onerror = () => reject(new Error('טעינת מערכת הסליקה נכשלה'));
      document.body.appendChild(s);
    };

    if (document.querySelector(JQUERY_SCRIPT_SELECTOR)) {
      injectSumit();
      return;
    }

    const jq = document.createElement('script');
    jq.src = 'https://code.jquery.com/jquery-3.7.1.min.js';
    jq.integrity = 'sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=';
    jq.crossOrigin = 'anonymous';
    jq.async = true;
    jq.dataset.hotam = 'jquery';
    jq.onload = injectSumit;
    jq.onerror = () => reject(new Error('טעינת jQuery נכשלה'));
    document.body.appendChild(jq);
  });

  return sumitLoadPromise;
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
  const [chargeError, setChargeError] = useState<string | null>(null);
  const [isSumitReady, setIsSumitReady] = useState(false);
  const [sumitError, setSumitError] = useState<string | null>(null);
  
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [recipientCity, setRecipientCity] = useState('');
  const [selectedCityCoords, setSelectedCityCoords] = useState<{ lat: number; lng: number } | null>(null);
  const pendingOrderRef = useRef<{ orderId: string; verificationCode: string } | null>(null);
  const chargeInFlightRef = useRef(false);
  const sumitFormRef = useRef<HTMLFormElement | null>(null);
  const shippingAddressInputRef = useRef<HTMLInputElement>(null);
  const processPaymentWithTokenRef = useRef<(token: string) => Promise<void>>(async () => {
    throw new Error('מעבד התשלום לא אותחל. אנא רענן את הדף ונסה שוב.');
  });

  const getSumitTokenInput = useCallback((form?: HTMLFormElement | null) => {
    return (form || sumitFormRef.current)?.elements.namedItem('og-token') as HTMLInputElement | null;
  }, []);

  const resetSumitToken = useCallback(() => {
    const tokenInput = getSumitTokenInput();
    if (tokenInput) tokenInput.value = '';
  }, [getSumitTokenInput]);

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

  useEffect(() => {
    let cancelled = false;
    if (!recipientCity || recipientCity === 'כל הארץ') {
      setSelectedCityCoords(null);
      return () => {
        cancelled = true;
      };
    }

    geocodeAddressWithGoogle(`${recipientCity}, ישראל`)
      .then((geo) => {
        if (cancelled) return;
        if (typeof geo.lat === 'number' && typeof geo.lng === 'number') {
          setSelectedCityCoords({ lat: geo.lat, lng: geo.lng });
          return;
        }
        setSelectedCityCoords(null);
      })
      .catch(() => {
        if (!cancelled) setSelectedCityCoords(null);
      });

    return () => {
      cancelled = true;
    };
  }, [recipientCity]);

  useEffect(() => {
    if (!shippingAddressInputRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMapsPlacesScript()
      .then(() => {
        if (cancelled || !shippingAddressInputRef.current || !window.google?.maps?.places) return;
        autocomplete = new window.google.maps.places.Autocomplete(shippingAddressInputRef.current, {
          types: ['address'],
          fields: ['formatted_address', 'address_components'],
          componentRestrictions: { country: 'il' },
          bounds: selectedCityCoords
            ? new window.google.maps.LatLngBounds(
                new window.google.maps.LatLng(selectedCityCoords.lat - 0.2, selectedCityCoords.lng - 0.2),
                new window.google.maps.LatLng(selectedCityCoords.lat + 0.2, selectedCityCoords.lng + 0.2),
              )
            : undefined,
          strictBounds: Boolean(selectedCityCoords),
        });
        listener = autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.formatted_address) {
            setRecipientAddress(place.formatted_address);
          }
          const city = getCityFromAddressComponents(place?.address_components);
          if (city) {
            setRecipientCity(city);
          }
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      // clearInstanceListeners removes all listeners (including our place_changed one),
      // so it is preferred; fall back to removeListener if the API is not yet loaded.
      if (autocomplete && window.google?.maps?.event?.clearInstanceListeners) {
        window.google.maps.event.clearInstanceListeners(autocomplete);
      } else if (listener && window.google?.maps?.event?.removeListener) {
        window.google.maps.event.removeListener(listener);
      }
    };
  }, [selectedCityCoords, deliveryChoice]);

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
    if (!SUMIT_COMPANY_ID || !SUMIT_PUBLIC_KEY) {
      setSumitError('חסרים פרטי הזדהות של מערכת הסליקה.');
      return;
    }
    let cancelled = false;
    loadSumitScripts()
      .then(() => {
        if (cancelled) return;
        (window as any).jQuery?.(() => {
          if (cancelled) return;
          const payments = (window as any).OfficeGuy?.Payments;
          if (!payments?.BindFormSubmit) {
            setIsSumitReady(false);
            setSumitError('מערכת הסליקה לא נטענה.');
            return;
          }
          payments.BindFormSubmit({
            CompanyID: SUMIT_COMPANY_ID,
            APIPublicKey: SUMIT_PUBLIC_KEY,
            Callback: async (token: string | null) => {
              if (!token) return;
              try {
                await processPaymentWithTokenRef.current(token);
              } catch (err: any) {
                setChargeError(err?.message || 'חלה שגיאה בחיוב.');
              }
            }
          });
          setIsSumitReady(true);
          setSumitError(null);
        });
      })
      .catch((err) => {
        if (!cancelled) setSumitError(err.message || 'מערכת הסליקה לא נטענה.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const validateCheckout = useCallback(() => {
    if (!deliveryChoice) {
      return 'אנא בחר אופן קבלת המוצר.';
    }

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
      console.error('Failed to persist pending order before charge:', error);
      throw new Error(error.message || 'לא ניתן היה לשמור את פרטי ההזמנה.');
    }

    pendingOrderRef.current = { orderId: shortId, verificationCode: vCode };
    return shortId;
  }, [db, deliveryChoice, product, productId, recipientAddress, recipientCity, recipientName, recipientPhone, totalPrice, user?.email, user?.uid]);

  const processPaymentWithToken = useCallback(async (token: string) => {
    if (chargeInFlightRef.current) {
      return;
    }

    chargeInFlightRef.current = true;
    setIsProcessing(true);
    setChargeError(null);

    try {
      const orderId = await upsertPendingOrder();
      const productDescription = product?.product_name || product?.product_type || FALLBACK_PRODUCT_DESCRIPTION;
      const cartData = {
        orderId,
        price: totalPrice,
        productName: productDescription,
        customerName: recipientName,
        customerEmail: user?.email || '',
        customerPhone: recipientPhone,
      };

      const response = await fetch('/api/payments/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          cartData,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data.error || 'לא ניתן היה להשלים את החיוב.');
      }

      setIsSuccess(true);
      router.push('/checkout/success');
    } catch (err: any) {
      console.error('Payment Charge Error:', err);
      setChargeError(err.message || 'חלה שגיאה בחיבור למערכת הסליקה.');
      setIsProcessing(false);
      chargeInFlightRef.current = false;
      resetSumitToken();
    }
  }, [product?.product_name, product?.product_type, recipientPhone, resetSumitToken, router, totalPrice, upsertPendingOrder, user?.email]);

  useEffect(() => {
    processPaymentWithTokenRef.current = processPaymentWithToken;
  }, [processPaymentWithToken]);

  const handlePayClick = useCallback(() => {
    if (chargeInFlightRef.current) return;

    const validationError = validateCheckout();
    if (validationError) {
      toast({ variant: "destructive", title: "פרטים חסרים", description: validationError });
      return;
    }

    if (!isSumitReady || !SUMIT_COMPANY_ID || !SUMIT_PUBLIC_KEY) {
      toast({ variant: "destructive", title: "מערכת הסליקה לא מוכנה", description: sumitError || 'נסו שוב בעוד רגע.' });
      return;
    }

    window.OfficeGuy!.Payments!.CreateToken({
      CompanyID: SUMIT_COMPANY_ID,
      APIPublicKey: SUMIT_PUBLIC_KEY,
      FormSelector: 'form[data-og="form"]',
      Callback: async (token: string | null) => {
        if (!token) return;
        try {
          await processPaymentWithTokenRef.current(token);
        } catch (err: any) {
          setChargeError(err?.message || 'חלה שגיאה בחיוב.');
        }
      }
    });
  }, [isSumitReady, sumitError, toast, validateCheckout]);

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
                  <h2 className="text-xl font-black">פרטי התקשרות</h2>
                  <User className="w-6 h-6 text-accent" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>שם מלא *</Label><Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="text-right h-12 rounded-xl" /></div>
                  <div className="space-y-2"><Label>טלפון לקבלת קוד אימות *</Label><Input value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} className="text-right h-12 rounded-xl" placeholder="למשל: 0501234567" /></div>
                </div>
              </Card>

              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="text-xl font-black">אופן קבלת המוצר</h2>
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
                      <div className="relative"><Input ref={shippingAddressInputRef} placeholder="רחוב, מספר בית, דירה..." value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} className="text-right pr-10 h-12 rounded-xl" /><MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /></div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-5 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b pb-4">
                  <h2 className="text-xl font-black">פרטי תשלום</h2>
                  <CreditCard className="w-6 h-6 text-accent" />
                </div>

                <form ref={sumitFormRef} data-og="form" className="space-y-4">
                  <div className="og-errors rounded-2xl bg-destructive/10 text-destructive text-sm font-bold empty:hidden px-4 py-3" />
                  <input type="hidden" name="og-token" />

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
                  {chargeError && (
                    <div className="flex items-start gap-2 rounded-2xl bg-red-50 text-red-600 px-4 py-3 text-sm font-bold mb-4">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{chargeError}</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    onClick={handlePayClick}
                    disabled={!isSumitReady || isProcessing}
                    className="w-full bg-primary text-white hover:bg-primary/90 h-16 rounded-2xl shadow-xl font-black text-xl uppercase tracking-widest gap-3"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        מעבד תשלום מאובטח...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-6 h-6" />
                        בצע תשלום מאובטח - ₪{totalPrice}
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            </div>
            
            <div className="md:col-span-2 space-y-6">
              <Card className="border-none shadow-premium rounded-[2.5rem] bg-white p-6 sticky top-32">
                <h2 className="font-black text-primary border-b pb-3 mb-4">סיכום הזמנה</h2>
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
              <CheckCircle2 className="w-24 h-24 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-black text-primary mb-2">התשלום עבר בהצלחה!</h1>
            <p className="text-muted-foreground font-bold">מייד תועבר לאישור ההזמנה.</p>
          </Card>
        )}
      </main>
    </div>
  );
}
