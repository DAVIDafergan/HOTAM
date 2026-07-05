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
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';

// השארנו רק את ה-hook של המשתמש (בהנחה שהוא מנוהל על ידי Supabase Auth)
import { useUser } from '@/lib/supabase-hooks'; 
// ייבוא הלקוח הסטנדרטי של סופאבייס (ללא קבצי compat!)
import { supabase } from '@/lib/supabase';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import Image from '@/components/SmartImage';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { analyzeChatMessage, CHAT_BLOCK_ERROR_MESSAGE } from '@/lib/chat-guard';

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
  is_read?: boolean;
}

function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const otherUserId = params?.id as string;
  const originProductIdFromUrl = searchParams.get('productId');
  
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
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
  // Presence: true when the other user is actively viewing this chat
  const [isOtherUserPresent, setIsOtherUserPresent] = useState(false);

  // שומר על משתמשים לא מחוברים בחוץ
  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login?redirect=' + encodeURIComponent(pathname));
  }, [user, isUserLoading, router, pathname]);

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
      
      if (msgs) {
        setMessages(msgs);
        // Mark unread messages from the other user as read
        const unreadIds = msgs
          .filter(m => m.sender_id === otherUserId && m.is_read === false)
          .map(m => m.id);
        if (unreadIds.length > 0) {
          const unreadSet = new Set(unreadIds);
          supabase.from('messages')
            .update({ is_read: true })
            .in('id', unreadIds)
            .then(({ error }) => {
              if (!error) {
                setMessages(prev => prev.map(m => unreadSet.has(m.id) ? { ...m, is_read: true } : m));
              }
            });
        }
      }
      setIsMessagesLoading(false);
    };

    fetchChatAndMessages();

    // האזנה בזמן אמת להודעות חדשות!
    const channel = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, 
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Deduplicate: skip if a message with this id already exists (e.g. optimistic update was replaced)
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // If this incoming message is from the other user, mark it as read immediately
          if (newMsg.sender_id === otherUserId) {
            supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id)
              .then(({ error }) => {
                if (!error) {
                  setMessages(prev => prev.map(m => m.id === newMsg.id ? { ...m, is_read: true } : m));
                }
              });
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages(prev => prev.map(m => m.id === (payload.new as Message).id ? { ...m, ...(payload.new as Message) } : m));
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

  // Presence: track current user in the chat channel and detect if the other user is present
  useEffect(() => {
    if (!chatId || !user?.uid || !otherUserId) return;

    const presenceChannel = supabase.channel(`presence_${chatId}`);
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<{ user_id: string }>();
        const allPresent = (Object.values(state).flat() as Array<{ user_id: string }>);
        setIsOtherUserPresent(allPresent.some(p => p.user_id === otherUserId));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ user_id: user.uid });
        }
      });

    return () => { supabase.removeChannel(presenceChannel); };
  }, [chatId, user?.uid, otherUserId]);

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
      let { data: seller } = await supabase.from('sellers').select('*').eq('id', otherUserId).maybeSingle();
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
    const result = analyzeChatMessage(text);
    const hasViolation = result.blocked;

    if (hasViolation) {
      setSecurityViolation(true);
      if (chatId) {
        supabase.from('chats').update({ 
          is_suspicious: true,
          last_violation_at: new Date().toISOString(),
          last_violation_text: text
        }).eq('id', chatId).then();
      }
      toast({
        variant: "destructive",
        title: "פעולה אסורה זוהתה",
        description: result.reason || "חל איסור מוחלט על העברת פרטי קשר. המקרה דווח למערכת.",
      });
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
    const { data: inserted, error: insertError } = await supabase.from('messages').insert([msgData]).select().single();
    if (insertError || !inserted) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMsg.id));
      setNewMessage(textCopy);
      if (insertError?.message === CHAT_BLOCK_ERROR_MESSAGE) {
        setSecurityViolation(true);
        toast({ variant: "destructive", title: "ההודעה נחסמה", description: "ניסיון לשתף פרטי קשר או מזהה חיצוני נחסם." });
      } else {
        toast({ variant: "destructive", title: "שליחת ההודעה נכשלה", description: "אנא נסה שוב." });
      }
      return;
    }

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

    if (otherUserData?.email && !isOtherUserPresent) {
      // Respect the recipient's email notification preference.
      // Sellers use `notification_email`; customers use `notif_msg_email`.
      const emailNotifEnabled = otherSellerData
        ? otherUserData?.notification_email !== false
        : otherUserData?.notif_msg_email !== false;

      // Throttle: send at most one email per hour per chat to avoid flooding.
      const lastEmailAt = chatData?.last_email_notif_at;
      const oneHourAgo = Date.now() - 3_600_000;
      const shouldSendEmail =
        emailNotifEnabled &&
        (!lastEmailAt || new Date(lastEmailAt).getTime() < oneHourAgo);

      if (shouldSendEmail) {
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
            subject: `הודעות ממתינות לך ב-Hotam`,
            text: `יש לך הודעות חדשות מ-${senderName}. לצפייה ולהשבה, כנס/י לאתר: ${chatLink}`,
            senderName,
            message: textCopy,
            link: chatLink,
          }),
        }).catch((err) => console.error('Failed to send email notification:', err));

        // Record the time we sent the throttle email on the chat document.
        supabase.from('chats').update({ last_email_notif_at: new Date().toISOString() })
          .eq('id', chatId)
          .then(({ error }) => { if (error) console.error('Failed to update last_email_notif_at:', error); });
      }
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
          
          <CardHeader className="border-b p-4 flex flex-row items-center justify-between bg-primary text-white shrink-0 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="h-11 w-11 border-2 border-white/20 shadow-sm">
                  <AvatarImage src={otherUserData?.profile_image} />
                  <AvatarFallback><User className="w-5 h-5 text-primary/20" /></AvatarFallback>
                </Avatar>
                {isOtherUserPresent && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 border-2 border-primary" aria-hidden="true" />
                )}
              </div>
              <div className="text-right">
                <CardTitle className="text-base font-headline font-black tracking-tight leading-tight">{displayName}</CardTitle>
                <div className="flex items-center gap-1.5 opacity-70">
                  <span className="text-[9px] font-bold uppercase tracking-widest">
                    {isOtherUserPresent ? 'מחובר/ת כעת' : (otherSellerData ? 'מוכר מוסמך' : 'לקוח')}
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
                <div key={msg.id} className={`flex ${isMine ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] p-3.5 sm:p-4 rounded-[1.35rem] text-base shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-all ${
                    isMine
                      ? 'bg-primary text-white rounded-tr-md'
                      : 'bg-white text-primary border border-slate-100 rounded-tl-md'
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
                              <Image src={msg.product_image} alt="Product" fill kind="product" sizes="160px" className="object-cover" />
                            </div>
                          )}
                          <div className="space-y-0.5 text-right">
                            <p className="text-[10px] opacity-80 leading-tight">מוצר: <span className="font-bold">{msg.product_name}</span></p>
                            <p className="text-xl font-black leading-none">₪{msg.amount}</p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          asChild
                          className={cn(
                            "w-full h-9 rounded-xl text-[10px] font-black transition-all duration-200",
                            isMine
                              ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                              : "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10"
                          )}
                        >
                          <Link href={`/checkout/${msg.product_id}`}>מעבר לתשלום מאובטח</Link>
                        </Button>
                      </div>
                    ) : (
                      <p className="leading-relaxed font-medium text-right whitespace-pre-wrap">{msg.text}</p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      <p className="text-[8px] opacity-40 font-bold">{timeString}</p>
                      {isMine && (
                        <p className={`text-[9px] font-black leading-none ${msg.is_read ? 'text-blue-300 opacity-100' : 'text-white/40'}`}>
                          {msg.is_read ? '✓✓' : '✓'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && !isMessagesLoading && (
               <div className="flex flex-col items-center justify-center gap-3 py-20 text-center animate-in fade-in duration-500">
                 <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/5">
                   <Send className="h-5 w-5 text-primary/25" />
                 </div>
                 <p className="text-muted-foreground/40 italic text-xs">תחילת התכתבות עם {displayName}...</p>
               </div>
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
                className="rounded-full h-12 w-12 bg-primary hover:bg-primary/90 shrink-0 shadow-lg transition-all duration-200 hover:scale-105 active:scale-90 disabled:opacity-40 disabled:hover:scale-100"
                aria-label="שלח הודעה"
              >
                <Send className="w-5 h-5 -translate-x-px" />
              </Button>
              <textarea
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  if (securityViolation) setSecurityViolation(false);
                }}
                placeholder="כתוב הודעה..."
                rows={1}
                className="flex-1 rounded-2xl bg-slate-100 border border-transparent text-right py-3.5 px-4 text-base font-medium focus:ring-2 focus:ring-primary/15 focus:border-primary/10 focus:bg-white resize-none max-h-32 transition-all duration-200 overflow-hidden"
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
      className={`flex items-center gap-4 p-3 rounded-2xl border transition-all duration-200 text-right group active:scale-[0.98] ${highlight ? 'border-accent bg-accent/5' : 'border-slate-100 hover:border-accent hover:bg-accent/5'}`}
    >
      <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border bg-muted">
        {product.images?.[0] && <Image src={product.images[0]} alt={product.product_type} fill sizes="56px" className="object-cover transition-transform duration-300 group-hover:scale-110" />}
      </div>
      <div className="flex-1 space-y-0.5">
        <h4 className="font-bold text-sm text-primary group-hover:text-accent transition-colors">{product.product_type}</h4>
        <p className="text-[10px] text-muted-foreground font-medium">{product.script_type}</p>
        <p className="text-sm font-black text-primary">₪{product.price}</p>
      </div>
      <Plus className="w-5 h-5 text-accent opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:rotate-90" />
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
