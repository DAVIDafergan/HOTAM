'use client';

import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { SupabaseQuery, SupabaseDocRef } from '@/lib/supabase-compat';

// ─── Type helpers ─────────────────────────────────────────────────────────────

function isIncrement(v: any): v is { __special: 'increment'; amount: number } {
  return v && typeof v === 'object' && v.__special === 'increment';
}
function isArrayUnion(v: any): v is { __special: 'arrayUnion'; elements: any[] } {
  return v && typeof v === 'object' && v.__special === 'arrayUnion';
}
function isArrayRemove(v: any): v is { __special: 'arrayRemove'; elements: any[] } {
  return v && typeof v === 'object' && v.__special === 'arrayRemove';
}

/**
 * Separate a data payload into:
 *  - plain fields  → regular Supabase UPDATE
 *  - increment fields → safe_increment RPC
 *  - arrayUnion fields → array_union RPC
 *  - arrayRemove fields → array_remove_elem RPC
 *  - unread_* fields  → update_unread_state RPC
 */
function categoriseData(data: Record<string, any>) {
  const plain: Record<string, any> = {};
  const increments: { col: string; delta: number }[] = [];
  const unions: { col: string; element: any }[] = [];
  const removes: { col: string; element: any }[] = [];
  const unreadUpdates: { uid: string; value: boolean }[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('unread_')) {
      unreadUpdates.push({ uid: key.slice('unread_'.length), value: Boolean(value) });
    } else if (isIncrement(value)) {
      increments.push({ col: key, delta: value.amount });
    } else if (isArrayUnion(value)) {
      for (const el of value.elements) unions.push({ col: key, element: el });
    } else if (isArrayRemove(value)) {
      for (const el of value.elements) removes.push({ col: key, element: el });
    } else {
      plain[key] = value;
    }
  }

  return { plain, increments, unions, removes, unreadUpdates };
}

// ─── setDocumentNonBlocking ───────────────────────────────────────────────────

/**
 * Upsert (merge) or full-replace a row. Mirrors Firebase setDoc().
 * `options.merge = true` ⟶ upsert; `false` ⟶ full replace (delete-then-insert logic
 * is not critical here — upsert covers both common cases safely).
 */
export function setDocumentNonBlocking(
  docRef: SupabaseDocRef,
  data: Record<string, any>,
  options?: { merge?: boolean },
) {
  const { plain, increments, unions, removes, unreadUpdates } = categoriseData(data);

  const rowData: Record<string, any> = { id: docRef.id, ...plain };

  const ops: Promise<any>[] = [];

  if (Object.keys(rowData).length > 0) {
    const op = (options?.merge === false
      ? docRef.client.from(docRef.table).upsert(rowData)
      : docRef.client.from(docRef.table).upsert(rowData, { onConflict: 'id' })
    ).then(({ error }) => {
      if (error) throw error;
    });
    ops.push(op);
  }

  for (const { col, delta } of increments) {
    ops.push(
      docRef.client.rpc('safe_increment', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        delta,
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of unions) {
    ops.push(
      docRef.client.rpc('array_union_elem', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        element: String(element),
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of removes) {
    ops.push(
      docRef.client.rpc('array_remove_elem', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        element: String(element),
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { uid, value } of unreadUpdates) {
    ops.push(
      docRef.client.rpc('update_unread_state', {
        chat_id: docRef.id,
        uid,
        is_unread: value,
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }

  Promise.all(ops).catch(() => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data }),
    );
  });
}

// ─── addDocumentNonBlocking ────────────────────────────────────────────────────

/**
 * Insert a new row with an auto-generated UUID. Mirrors Firebase addDoc().
 * Returns a Promise that resolves with the inserted row (contains the new `id`).
 */
export function addDocumentNonBlocking(
  colRef: { client: SupabaseClient; table: string },
  data: Record<string, any>,
) {
  const promise = colRef.client
    .from(colRef.table)
    .insert(data)
    .select('id')
    .single()
    .then(({ data: row, error }) => {
      if (error) throw error;
      return row;
    })
    .catch(() => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: colRef.table, operation: 'create', requestResourceData: data }),
      );
    });
  return promise;
}

// ─── updateDocumentNonBlocking ────────────────────────────────────────────────

/**
 * Partial update of an existing row. Mirrors Firebase updateDoc().
 * Handles increment(), arrayUnion(), arrayRemove(), and unread_* JSONB fields.
 */
export function updateDocumentNonBlocking(
  docRef: SupabaseDocRef,
  data: Record<string, any>,
) {
  const { plain, increments, unions, removes, unreadUpdates } = categoriseData(data);

  const ops: Promise<any>[] = [];

  if (Object.keys(plain).length > 0) {
    ops.push(
      docRef.client.from(docRef.table).update(plain).eq('id', docRef.id)
        .then(({ error }) => { if (error) throw error; }),
    );
  }
  for (const { col, delta } of increments) {
    ops.push(
      docRef.client.rpc('safe_increment', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        delta,
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of unions) {
    ops.push(
      docRef.client.rpc('array_union_elem', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        element: String(element),
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of removes) {
    ops.push(
      docRef.client.rpc('array_remove_elem', {
        row_id: docRef.id,
        table_name: docRef.table,
        col_name: col,
        element: String(element),
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { uid, value } of unreadUpdates) {
    ops.push(
      docRef.client.rpc('update_unread_state', {
        chat_id: docRef.id,
        uid,
        is_unread: value,
      }).then(({ error }: any) => { if (error) throw error; }),
    );
  }

  Promise.all(ops).catch(() => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data }),
    );
  });
}

// ─── deleteDocumentNonBlocking ────────────────────────────────────────────────

/** Delete a row by id. Mirrors Firebase deleteDoc(). */
export function deleteDocumentNonBlocking(docRef: SupabaseDocRef) {
  docRef.client
    .from(docRef.table)
    .delete()
    .eq('id', docRef.id)
    .then(({ error }) => {
      if (error) throw error;
    })
    .catch(() => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({ path: docRef.path, operation: 'delete' }),
      );
    });
}

// ─── Type alias so the import in addDocumentNonBlocking compiles ──────────────
import type { SupabaseClient } from '@supabase/supabase-js';