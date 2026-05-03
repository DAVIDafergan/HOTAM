'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { errorEmitter } from '@/lib/error-emitter';
import { DatabasePermissionError } from '@/lib/errors';
import type { SupabaseDocRef } from '@/lib/supabase-compat';

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

function buildRpcOps(
  client: SupabaseClient,
  rowId: string,
  table: string,
  increments: { col: string; delta: number }[],
  unions: { col: string; element: any }[],
  removes: { col: string; element: any }[],
  unreadUpdates: { uid: string; value: boolean }[],
): PromiseLike<any>[] {
  const ops: PromiseLike<any>[] = [];

  for (const { col, delta } of increments) {
    ops.push(
      client.rpc('safe_increment', { row_id: rowId, table_name: table, col_name: col, delta })
        .then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of unions) {
    ops.push(
      client.rpc('array_union_elem', { row_id: rowId, table_name: table, col_name: col, element: String(element) })
        .then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { col, element } of removes) {
    ops.push(
      client.rpc('array_remove_elem', { row_id: rowId, table_name: table, col_name: col, element: String(element) })
        .then(({ error }: any) => { if (error) throw error; }),
    );
  }
  for (const { uid, value } of unreadUpdates) {
    ops.push(
      client.rpc('update_unread_state', { chat_id: rowId, uid, is_unread: value })
        .then(({ error }: any) => { if (error) throw error; }),
    );
  }

  return ops;
}

// ─── setDocumentNonBlocking ───────────────────────────────────────────────────

export function setDocumentNonBlocking(
  docRef: SupabaseDocRef,
  data: Record<string, any>,
  options?: { merge?: boolean },
) {
  const { plain, increments, unions, removes, unreadUpdates } = categoriseData(data);
  const rowData: Record<string, any> = { id: docRef.id, ...plain };
  const ops: PromiseLike<any>[] = [];

  if (Object.keys(rowData).length > 0) {
    ops.push(
      Promise.resolve(
        options?.merge === false
          ? docRef.client.from(docRef.table).upsert(rowData)
          : docRef.client.from(docRef.table).upsert(rowData, { onConflict: 'id' }),
      ).then(({ error }) => { if (error) throw error; }),
    );
  }

  ops.push(...buildRpcOps(docRef.client, docRef.id, docRef.table, increments, unions, removes, unreadUpdates));

  Promise.all(ops).catch(() => {
    errorEmitter.emit('permission-error', new DatabasePermissionError({
      path: docRef.path, operation: 'write', requestResourceData: data,
    }));
  });
}

// ─── addDocumentNonBlocking ────────────────────────────────────────────────────

export function addDocumentNonBlocking(
  colRef: { client: SupabaseClient; table: string },
  data: Record<string, any>,
) {
  const promise = Promise.resolve(
    colRef.client.from(colRef.table).insert(data).select('id').single(),
  ).then(({ data: row, error }) => {
    if (error) throw error;
    return row;
  }).catch(() => {
    errorEmitter.emit('permission-error', new DatabasePermissionError({
      path: colRef.table, operation: 'create', requestResourceData: data,
    }));
  });
  return promise;
}

// ─── updateDocumentNonBlocking ────────────────────────────────────────────────

export function updateDocumentNonBlocking(
  docRef: SupabaseDocRef,
  data: Record<string, any>,
) {
  const { plain, increments, unions, removes, unreadUpdates } = categoriseData(data);
  const ops: PromiseLike<any>[] = [];

  if (Object.keys(plain).length > 0) {
    ops.push(
      Promise.resolve(
        docRef.client.from(docRef.table).update(plain).eq('id', docRef.id),
      ).then(({ error }) => { if (error) throw error; }),
    );
  }

  ops.push(...buildRpcOps(docRef.client, docRef.id, docRef.table, increments, unions, removes, unreadUpdates));

  Promise.all(ops).catch(() => {
    errorEmitter.emit('permission-error', new DatabasePermissionError({
      path: docRef.path, operation: 'update', requestResourceData: data,
    }));
  });
}

// ─── deleteDocumentNonBlocking ────────────────────────────────────────────────

export function deleteDocumentNonBlocking(docRef: SupabaseDocRef) {
  Promise.resolve(
    docRef.client.from(docRef.table).delete().eq('id', docRef.id),
  ).then(({ error }) => {
    if (error) throw error;
  }).catch(() => {
    errorEmitter.emit('permission-error', new DatabasePermissionError({
      path: docRef.path, operation: 'delete',
    }));
  });
}
