"use client";

import { useState, useRef, useEffect, useMemo, Suspense } from 'react';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Send, ShieldAlert, CreditCard, Info, PackageCheck, 
  Loader2, Package, Plus, AlertTriangle, User, ShieldCheck 
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

// השארנו רק את ה-hook של המשתמש (בהנחה שהוא מנוהל על ידי Supabase Auth)
import { useUser } from '@/lib/supabase-hooks'; 
// ייבוא הלקוח הסטנדרטי של סופאבייס (ללא קבצי compat!)
import { supabase } from '@/lib/supabase';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  timestamp: string;
  is_payment_request?: boolean;
  amount?: number;
  product_name?: string;
  product_image?: string;
  product_id?: string;
}

function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const otherUserId = params?.id as string;
  const originProductIdFromUrl = searchParams.get('productId');
  
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  
  const [newMessage, setNewMessage] = useState('');
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [securityViolation, setSecurityViolation] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // States לניהול הנתונים הישיר מול Supabase
  const [chatData, setChatData] = useState<any>(null);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(true);
  
  const [originProduct, setOriginProduct] = useState<any>(null);
  const [otherUserData, setOtherUserData] = useState<any>(null);
  const [otherSellerData, setOtherSellerData] = useState<any>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  // שומר על משתמשים לא מחוברים בחוץ
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  // יצירת מזהה חדר צ'אט ייחודי
  const chatId = useMemo(() => {
    if (!user || !otherUserId) return null;
    return [user.uid, otherUserId].sort().join('_');
  }, [user?.uid, otherUserId]);

  // מניעת שיחה עם עצמך
  useEffect(() => {
    if (!isUserLoading && user && otherUserId && otherUserId === user.uid) {
      router.push('/seller/dashboard');
    }
  }, [user, otherUserId, isUserLoading, router]);

  // 1. Fetching Chat & Messages + Realtime Subscription
  useEffect(() => {
    if (!chatId) return;

    const fetchChatAndMessages = async () => {
      // הבאת נתוני הצ'אט
      const { data: chat } = await supabase.from('chats').select('*').eq('id', chatId).single();
      setChatData(chat || null);
      setIsChatLoading(false);

      // הבאת היסטוריית ההודעות
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('timestamp', { ascending: true });
      
      if (msgs) setMessages(msgs);
      setIsMessagesLoading(false);
    };

    fetchChatAndMessages();

    // האזנה בזמן אמת להודעות חדשות!
    const channel = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, 
        (payload) => {
          setMessages((prev) => {
            // Deduplicate: skip if a message with this id already exists (e.g. optimistic update was replaced)
            if (prev.some(m => m.id === (payload.new as Message).id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chats', filter: `id=eq.${chatId}` },
        (payload) => {
          setChatData(payload.new);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  // Handle Mark as Read
  useEffect(() => {
    if (chatId && user && chatData && chatData?.unread_state?.[user.uid] === true) {
      supabase.rpc('update_unread_state', { chat_id: chatId, uid: user.uid, is_unread: false })
        .then(({ error }) => { if (error) console.error('mark read error:', error); });
    }
  }, [chatData, user?.uid, chatId]);

  // Fetch Origin Product
  const effectiveOriginProductId = chatData?.origin_product_id || originProductIdFromUrl;
  useEffect(() => {
    if (!effectiveOriginProductId) return;
    const fetchOriginProduct = async () => {
      const { data } = await supabase.from('products').select('*').eq('id', effectiveOriginProductId).single();
      setOriginProduct(data);
    };
    fetchOriginProduct();
  }, [effectiveOriginProductId]);

  // Fetch Other User
  useEffect(() => {
    if (!otherUserId) return;
    const fetchOtherUser = async () => {
      let { data: seller } = await supabase.from('sellers').select('*').eq('id', otherUserId).single();
      if (seller) {
        setOtherSellerData(seller);
        setOtherUserData(seller);
      } else {
        let { data: customer } = await supabase.from('customers').select('*').eq('id', otherUserId).single();
        setOtherUserData(customer);
      }
    };
    fetchOtherUser();
  }, [otherUserId]);

  // Fetch current user's profile for display name
  useEffect(() => {
    if (!user) return;
    const fetchMyProfile = async () => {
      const [{ data: seller }, { data: customer }] = await Promise.all([
        supabase.from('sellers').select('first_name, last_name').eq('id', user.uid).single(),
        supabase.from('customers').select('first_name, last_name').eq('id', user.uid).single(),
      ]);
      if (seller) setMyProfile(seller);
      else if (customer) setMyProfile(customer);
    };
    fetchMyProfile();
  }, [user?.uid]);

  const canCreatePaymentRequest = user && originProduct && originProduct.seller_id === user.uid;

  // Fetch Seller Products
  useEffect(() => {
    if (!user || !canCreatePaymentRequest) return;
    const fetchSellerProducts = async () => {
      const { data } = await supabase.from('products').select('*').eq('seller_id', user.uid);
      if (data) setSellerProducts(data);
    };
    fetchSellerProducts();
  }, [user?.uid, canCreatePaymentRequest]);

  // יצירת צ'אט אם הוא לא קיים
  useEffect(() => {
    if (user && otherUserId && chatId && !isChatLoading && chatData === null) {
      const initChat = async () => {
        const { error } = await supabase.from('chats').insert([{
          id: chatId,
          participants: [user.uid, otherUserId],
          last_message_at: new Date().toISOString(),
          last_message_text: 'תחילת שיחה',
          updated_at: new Date().toISOString(),
          is_suspicious: false,
          origin_product_id: originProductIdFromUrl || null,
          unread_state: { [user.uid]: false, [otherUserId]: false }
        }]);

        if (!error || error.code === '23505') {
          const { data } = await supabase.from('chats').select('*').eq('id', chatId).single();
          setChatData(data);
        }
      };
      initChat();
    }
  }, [user, otherUserId, chatId, isChatLoading, chatData, originProductIdFromUrl]);

  // גלילה אוטומטית למטה
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const validateMessage = (text: string) => {
    const cleanText = text.toLowerCase().trim();
    const phoneRegex = /(?:(?:\+|00)972|0)\s*[234895](?:[\s\.\-]*\d){7,8}|(?:(?:\+|00)972|0)\s*5[0-9](?:[\s\.\-]*\d){7}/g;
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.[a-z]{2,})/g;
    const forbiddenPhrases = [
      'מספר', 'טלפון', 'נייד', 'פלאפון', 'סלולרי', 'וואטסאפ', 'ווצאפ', 'בווצאפ', 'בוואטסאפ', 
      'מייל', 'אימייל', 'צור קשר', 'תתקשר', 'דבר איתי', 'בפרטי', 'באישי', 'מחוץ לאתר', 
      'מספר שלי', 'הנייד שלי', 'פלא שלי', 'whatsapp', 'call me', 'phone', 'email', 'contact'
    ];

    const hasViolation = phoneRegex.test(text) || emailRegex.test(text) || urlRegex.test(text) || forbiddenPhrases.some(phrase => cleanText.includes(phrase));

    if (hasViolation) {
      setSecurityViolation(true);
      if (chatId) {
        supabase.from('chats').update({ 
          is_suspicious: true,
          last_violation_at: new Date().toISOString(),
          last_violation_text: text
        }).eq('id', chatId).then();
      }
      toast({ variant: "destructive", title: "פעולה אסורה זוהתה", description: "חל איסור מוחלט על העברת פרטי קשר. המקרה דווח למערכת." });
      return false;
    }
    return true;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !chatId || !otherUserId) return;
    if (!validateMessage(newMessage)) return;

    const msgData = {
      chat_id: chatId,
      sender_id: user.uid,
      text: newMessage,
      timestamp: new Date().toISOString()
    };

    const textCopy = newMessage;
    setNewMessage('');
    setSecurityViolation(false);

    // Optimistic update – show the message immediately without waiting for realtime
    const optimisticMsg: Message = { ...msgData, id: `opt_${Date.now()}` };
    setMessages((prev) => [...prev, optimisticMsg]);

    // הוספת ההודעה ל-Supabase במקום Firebase!
    const { data: inserted } = await supabase.from('messages').insert([msgData]).select().single();
    if (inserted) {
      // Replace optimistic entry with the real one (correct id from DB)
      setMessages((prev) => prev.map(m => m.id === optimisticMsg.id ? inserted as Message : m));
    }
    await supabase.rpc('update_unread_state', { chat_id: chatId, uid: otherUserId, is_unread: true });
    await supabase.from('chats').update({
      last_message_at: new Date().toISOString(),
      last_message_text: textCopy,
      updated_at: new Date().toISOString()
    }).eq('id', chatId);

    if (otherUserData?.email) {
      const profileName = myProfile?.first_name
        ? `${myProfile.first_name}${myProfile.last_name ? ' ' + myProfile.last_name : ''}`
        : null;
      const senderName = profileName || (user.email ? user.email.split('@')[0] : null) || 'משתמש';
      const chatLink = `https://hotam.shop/chat/${user.uid}`;
      fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: otherUserData.email,
          subject: `הודעה חדשה מ-${senderName} ב-Hotam`,
          text: `קיבלת הודעה חדשה מ-${senderName}:\n\n"${textCopy}"\n\nלתגובה, כנס/י לאתר: ${chatLink}`,
          senderName,
          message: textCopy,
          link: chatLink,
        }),
      }).catch((err) => console.error('Failed to send email notification:', err));
    }
  };

  const sendPaymentRequest = async (product: any) => {
    if (!user || !chatId || !otherUserId) return;
    const text = `בקשת רכישה עבור: ${product.product_type}. אנא פנה אלי לתיאום התשלום.`;
    
    const msgData = {
      chat_id: chatId,
      sender_id: user.uid,
      text: text,
      is_payment_request: true,
      amount: product.price,
      product_name: product.product_type,
      product_image: product.images?.[0] || '',
      product_id: product.id,
      timestamp: new Date().toISOString()
    };
    
    setIsPaymentDialogOpen(false);

    // Optimistic update for payment request
    const optimisticPaymentMsg: Message = { ...msgData, id: `opt_${Date.now()}` };
    setMessages((prev) => [...prev, optimisticPaymentMsg]);

    const { data: insertedPayment } = await supabase.from('messages').insert([msgData]).select().single();
    if (insertedPayment) {
      setMessages((prev) => prev.map(m => m.id === optimisticPaymentMsg.id ? insertedPayment as Message : m));
    }
    await supabase.rpc('update_unread_state', { chat_id: chatId, uid: otherUserId, is_unread: true });
    await supabase.from('chats').update({
      last_message_at: new Date().toISOString(),
      last_message_text: text,
      updated_at: new Date().toISOString()
    }).eq('id', chatId);
  };

  if (isUserLoading || isChatLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  const displayName = otherUserData ? `${otherUserData.first_name} ${otherUserData.last_name}` : 'טוען...';

  return (
    <div className="flex flex-col h-[100dvh] bg-[#F8F9FA] overflow-hidden" dir="rtl">
      <Navbar />
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full pt-20 sm:pt-24 pb-2 px-2 sm:px-4 overflow-hidden relative" role="main">
        <Card className="flex-1 flex flex-col shadow-premium border-none rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-white relative">
          
          <CardHeader className="border-b p-4 flex flex-row items-center justify-between bg-primary text-white shrink-0">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border-2 border-white/20 shadow-sm">
                <AvatarImage src={otherUserData?.profile_image} />
                <AvatarFallback><User className="w-5 h-5 text-primary/20" /></AvatarFallback>
              </Avatar>
              <div className="text-right">
                <CardTitle className="text-base font-headline font-black tracking-tight">{displayName}</CardTitle>
                <div className="flex items-center gap-1.5 opacity-70">
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    {otherSellerData ? 'מוכר מוסמך' : 'לקוח'}
                  </span>
                  {otherSellerData?.is_approved && <ShieldCheck className="w-3 h-3 text-accent" aria-label="מאומת" />}
                </div>
              </div>
            </div>
          </CardHeader>

          <div className="bg-orange-50 border-b border-orange-100 p-3 flex items-center justify-center gap-3 shrink-0" role="alert">
            <ShieldAlert className="w-4 h-4 text-orange-600 shrink-0" />
            <p className="text-[10px] font-black text-orange-800 text-center leading-tight">
              חל איסור מוחלט על העברת פרטי קשר. כל ניסיון עקיפת מערכת יגרום לחסימה מיידית לצמיתות.
            </p>
          </div>

          <CardContent 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50 scroll-smooth"
            aria-live="polite"
          >
            {messages.map((msg) => {
              const isMine = msg.sender_id === user.uid;
              // Format Supabase timestamp ISO string
              const timeString = new Date(msg.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
              
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-1`}>
                  <div className={`max-w-[85%] p-3.5 sm:p-4 rounded-2xl text-base shadow-sm transition-all ${
                    isMine 
                      ? 'bg-primary text-white rounded-tr-none' 
                      : 'bg-white text-primary border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.is_payment_request ? (
                      <div className="space-y-3 min-w-[220px]">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                          <PackageCheck className="w-4 h-4 text-accent" />
                          <span className="font-black text-[10px] uppercase tracking-tight">בקשת רכישה</span>
                        </div>
                        <div className="flex gap-3 items-center">
                          {msg.product_image && (
                            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10">
                              <Image src={msg.product_image} alt="Product" fill className="object-cover" />
                            </div>
                          )}
                          <div className="space-y-0.5 text-right">
                            <p className="text-[10px] opacity-80 leading-tight">מוצר: <span className="font-bold">{msg.product_name}</span></p>
                            <p className="text-xl font-black leading-none">₪{msg.amount}</p>
                          </div>
                        </div>
                        <Button variant="outline" asChild className="w-full h-9 rounded-xl bg-white/10 border-white/20 text-white hover:bg-white/20 text-[10px] font-black">
                          <Link href={`/checkout/${msg.product_id}`}>מעבר לתשלום מאובטח</Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="leading-relaxed font-medium text-right whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <p className={`text-[8px] mt-1.5 opacity-40 font-bold text-right`}>{timeString}</p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && !isMessagesLoading && (
               <div className="text-center py-20 text-muted-foreground/30 italic text-xs">תחילת התכתבות עם {displayName}...</div>
            )}
          </CardContent>

          <div className="p-3 sm:p-4 border-t bg-white space-y-2 shrink-0">
            {securityViolation && (
              <div className="flex items-center gap-2 text-[10px] font-black text-destructive bg-destructive/5 p-3 rounded-xl border border-destructive/10 mb-2 animate-bounce" role="alert">
                <AlertTriangle className="w-4 h-4" />
                <span>ההודעה נחסמה! חל איסור על העברת פרטי קשר.</span>
              </div>
            )}
            
            <div className="flex gap-2 items-end">
              <Button 
                onClick={handleSendMessage}
                size="icon" 
                disabled={!newMessage.trim()}
                className="rounded-full h-12 w-12 bg-primary hover:bg-primary/90 shrink-0 shadow-lg transition-transform active:scale-95"
                aria-label="שלח הודעה"
              >
                <Send className="w-5 h-5" />
              </Button>
              <textarea 
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (securityViolation) setSecurityViolation(false);
                }}
                placeholder="כתוב הודעה..."
                rows={1}
                className="flex-1 rounded-2xl bg-slate-100 border-none text-right py-3.5 px-4 text-base font-medium focus:ring-2 focus:ring-primary/10 resize-none max-h-32 transition-all overflow-hidden"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
                aria-label="תיבת הודעה"
              />
            </div>
            
            <div className="flex items-center justify-between pt-1">
              {canCreatePaymentRequest && ( 
                <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 rounded-full border-accent/20 text-accent hover:bg-accent/5 text-[10px] h-9 px-4 font-black uppercase tracking-tight"
                    >
                      <CreditCard className="w-3.5 h-3.5" /> צור בקשת תשלום
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
                    <div className="bg-primary p-6 text-white text-right">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-headline font-black flex items-center gap-3">
                          <Package className="w-6 h-6 text-accent" /> שליחת בקשת תשלום
                        </DialogTitle>
                      </DialogHeader>
                    </div>
                    <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto bg-white">
                      {sellerProducts && sellerProducts.length > 0 ? (
                        <div className="grid gap-3">
                          {effectiveOriginProductId && sellerProducts.find((p: any) => p.id === effectiveOriginProductId) && (
                            <div className="space-y-2 mb-2">
                              <p className="text-[9px] font-black text-accent uppercase tracking-widest">המוצר ממנו התחילה השיחה:</p>
                              <PaymentProductItem 
                                product={sellerProducts.find((p: any) => p.id === effectiveOriginProductId)} 
                                onSelect={sendPaymentRequest} 
                                highlight 
                              />
                              <div className="h-px bg-muted my-4" />
                              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">מוצרים נוספים שלך:</p>
                            </div>
                          )}
                          {sellerProducts
                            .filter((p: any) => p.id !== effectiveOriginProductId)
                            .map((p: any) => (
                              <PaymentProductItem key={p.id} product={p} onSelect={sendPaymentRequest} />
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-10 space-y-4">
                          <Package className="w-12 h-12 text-muted-foreground mx-auto opacity-20" />
                          <p className="text-sm font-bold text-muted-foreground">לא נמצאו מוצרים במלאי.</p>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              <div className="flex items-center gap-1.5 text-muted-foreground mr-auto opacity-40">
                <div className="flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  <span className="text-[8px] font-bold uppercase">מוצפן ומבוטח</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

function PaymentProductItem({ product, onSelect, highlight = false }: any) {
  return (
    <button 
      onClick={() => onSelect(product)}
      className={`flex items-center gap-4 p-3 rounded-2xl border transition-all text-right group ${highlight ? 'border-accent bg-accent/5' : 'border-slate-100 hover:border-accent hover:bg-accent/5'}`}
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border bg-muted">
        {product.images?.[0] && <Image src={product.images[0]} alt={product.product_type} fill className="object-cover" />}
      </div>
      <div className="flex-1 space-y-0.5">
        <h4 className="font-bold text-sm text-primary group-hover:text-accent transition-colors">{product.product_type}</h4>
        <p className="text-[10px] text-muted-foreground font-medium">{product.script_type}</p>
        <p className="text-sm font-black text-primary">₪{product.price}</p>
      </div>
      <Plus className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-all" />
    </button>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <ChatContent />
    </Suspense>
  );
}
