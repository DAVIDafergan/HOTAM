"use client";

import { useEffect, useMemo, useState } from 'react';
import { Search, ShieldAlert, MessageSquare } from 'lucide-react';
import { useCollection, useSupabaseClient, useMemoStable } from '@/lib/supabase-hooks';
import { collection, query, orderBy, limit } from '@/lib/supabase-compat';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CHATS_FETCH_LIMIT = 500;
const CHATS_PAGE_SIZE = 15;
const MESSAGES_FETCH_LIMIT = 200;

interface ChatRow {
  id: string;
  participants: string[];
  last_message_at: string | null;
  last_message_text: string | null;
  is_suspicious: boolean;
  last_violation_at: string | null;
  last_violation_text: string | null;
  origin_product_id: string | null;
}

interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  timestamp: string;
  is_read: boolean;
}

function formatTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'עכשיו';
  if (diffMin < 60) return `לפני ${diffMin} דק'`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `לפני ${diffHr} שעות`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'אתמול';
  if (diffDay < 7) return `לפני ${diffDay} ימים`;
  return d.toLocaleDateString('he-IL');
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return `${parts[0][0] ?? ''}.${parts[1][0] ?? ''}`;
}

// Read-only admin view over the existing chats/messages tables — both already grant admins
// full read access via chats_admin_all / messages_admin_all RLS policies, so this needed no
// new backend work. participants is a plain TEXT[] of auth user ids (not FK-typed), so display
// names come from a single batched `profiles` lookup rather than per-chat seller/customer
// queries — profiles.full_name exists for every user regardless of role.
export function AdminChatsPanel() {
  const db = useSupabaseClient();

  const chatsQuery = useMemoStable(
    () => query(collection(db, 'chats'), orderBy('last_message_at', 'desc'), limit(CHATS_FETCH_LIMIT)),
    [db],
  );
  const { data: allChats, isLoading } = useCollection<ChatRow>(chatsQuery);

  const [searchTerm, setSearchTerm] = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    (allChats || []).forEach((c) => (c.participants || []).forEach((id) => ids.add(id)));
    return Array.from(ids);
  }, [allChats]);

  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (participantIds.length === 0) return;
    let cancelled = false;
    db.from('profiles').select('id, full_name').in('id', participantIds).then(({ data }) => {
      if (cancelled || !data) return;
      setProfileNames((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => { next[p.id] = p.full_name || 'משתמש'; });
        return next;
      });
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participantIds.join(','), db]);

  const nameFor = (id: string) => profileNames[id] || '...';

  const filteredChats = useMemo(() => {
    let list = allChats || [];
    if (flaggedOnly) list = list.filter((c) => c.is_suspicious);
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      list = list.filter((c) =>
        (c.participants || []).some((id) => nameFor(id).toLowerCase().includes(term)),
      );
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allChats, flaggedOnly, searchTerm, profileNames]);

  const paginatedChats = filteredChats.slice((page - 1) * CHATS_PAGE_SIZE, page * CHATS_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredChats.length / CHATS_PAGE_SIZE));

  const selectedChat = (allChats || []).find((c) => c.id === selectedChatId) || null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-[1.75rem] bg-white border p-4 shadow-premium">
        <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-full bg-primary/[0.03] px-4 h-11">
          <Search className="w-4 h-4 text-primary/40 shrink-0" />
          <Input
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            placeholder="חיפוש לפי שם לקוח או סופר..."
            className="border-none bg-transparent h-auto p-0 shadow-none focus-visible:ring-0 text-sm font-bold"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setFlaggedOnly(false); setPage(1); }}
            className={cn(
              "px-4 h-9 rounded-full text-[11px] font-black border-2 transition-all",
              !flaggedOnly ? "bg-primary text-primary-foreground border-primary" : "border-primary/10 text-primary/60",
            )}
          >
            הכל
          </button>
          <button
            type="button"
            onClick={() => { setFlaggedOnly(true); setPage(1); }}
            className={cn(
              "px-4 h-9 rounded-full text-[11px] font-black border-2 transition-all flex items-center gap-1.5",
              flaggedOnly ? "bg-destructive text-destructive-foreground border-destructive" : "border-destructive/25 text-destructive",
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> מסומן כחשוד
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5 items-start">
        <div className="rounded-[1.75rem] bg-white border shadow-premium overflow-hidden">
          <div className="px-5 py-3 border-b text-[10px] font-black uppercase tracking-widest text-primary/50">
            {isLoading ? 'טוען...' : `${filteredChats.length} שיחות`}
          </div>
          <div className="max-h-[560px] overflow-y-auto divide-y">
            {paginatedChats.length === 0 && !isLoading && (
              <p className="p-8 text-center text-sm font-bold text-muted-foreground italic">אין שיחות תואמות.</p>
            )}
            {paginatedChats.map((chat) => {
              const [idA, idB] = chat.participants || [];
              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setSelectedChatId(chat.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-4 text-right transition-colors hover:bg-primary/[0.03]",
                    selectedChatId === chat.id && "bg-accent/10 border-r-4 border-accent",
                  )}
                >
                  <div className="flex shrink-0">
                    <span className="w-9 h-9 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary/60 border-2 border-white">
                      {initials(nameFor(idA || ''))}
                    </span>
                    <span className="-mr-2.5 w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-[10px] font-black text-accent-strong border-2 border-white">
                      {initials(nameFor(idB || ''))}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-primary truncate">
                        {nameFor(idA || '')} ↔ {nameFor(idB || '')}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground shrink-0">{formatTime(chat.last_message_at)}</span>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground truncate mt-0.5">
                      {chat.last_message_text || 'אין הודעות עדיין'}
                    </p>
                    {chat.is_suspicious && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black text-destructive bg-destructive/5 rounded-full px-2 py-0.5">
                        <ShieldAlert className="w-2.5 h-2.5" /> ניסיון עקיפה — פרטי קשר
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 border-t">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={cn(
                    "w-7 h-7 rounded-full text-[10px] font-black",
                    page === i + 1 ? "bg-accent text-primary" : "text-primary/40 hover:bg-primary/5",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedChat ? (
          <ChatThreadPanel chat={selectedChat} nameFor={nameFor} />
        ) : (
          <div className="hidden lg:flex flex-col items-center justify-center gap-3 rounded-[1.75rem] bg-white border shadow-premium py-24 text-center">
            <MessageSquare className="w-8 h-8 text-primary/15" />
            <p className="text-sm font-bold text-muted-foreground">בחר שיחה מהרשימה כדי לצפות בה</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatThreadPanel({ chat, nameFor }: { chat: ChatRow; nameFor: (id: string) => string }) {
  const db = useSupabaseClient();
  const [messages, setMessages] = useState<MessageRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMessages(null);
    db.from('messages')
      .select('id, chat_id, sender_id, text, timestamp, is_read')
      .eq('chat_id', chat.id)
      .order('timestamp', { ascending: false })
      .limit(MESSAGES_FETCH_LIMIT)
      .then(({ data }) => {
        if (cancelled) return;
        setMessages((data || []).slice().reverse());
      });
    return () => { cancelled = true; };
  }, [chat.id, db]);

  const [idA, idB] = chat.participants || [];

  return (
    <div className="rounded-[1.75rem] bg-white border shadow-premium overflow-hidden flex flex-col">
      <div className="px-6 py-4 border-b">
        <h3 className="text-sm font-black text-primary">{nameFor(idA || '')} ↔ {nameFor(idB || '')}</h3>
        <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
          {chat.origin_product_id ? `מוצר: ${chat.origin_product_id}` : 'שיחה כללית'}
        </p>
      </div>

      {chat.is_suspicious && (
        <div className="px-6 py-3 bg-destructive/5 border-b border-destructive/15 flex items-center gap-2 text-[11px] font-bold text-destructive">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          שיחה זו סומנה אוטומטית{chat.last_violation_at ? ` — ${formatTime(chat.last_violation_at)}` : ''}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-3 max-h-[420px]">
        {messages === null && (
          <p className="text-center text-xs font-bold text-muted-foreground py-10">טוען הודעות...</p>
        )}
        {messages && messages.length === 0 && (
          <p className="text-center text-xs font-bold text-muted-foreground italic py-10">אין הודעות בשיחה זו.</p>
        )}
        {messages?.map((m) => {
          const isA = m.sender_id === idA;
          return (
            <div
              key={m.id}
              className={cn(
                "max-w-[75%] rounded-2xl px-4 py-2.5 text-[13px] font-medium leading-relaxed",
                isA ? "bg-primary/[0.04] rounded-br-md self-start" : "bg-accent/10 rounded-bl-md self-end mr-auto",
              )}
              style={{ marginInlineStart: isA ? 0 : 'auto', marginInlineEnd: isA ? 'auto' : 0 }}
            >
              {m.text}
              <span className="block text-[9px] font-bold text-muted-foreground/70 mt-1">
                {new Date(m.timestamp).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-6 py-3 border-t bg-primary/[0.015] text-center text-[10px] font-bold text-muted-foreground">
        תצוגה לקריאה בלבד
      </div>
    </div>
  );
}
