'use client';

/**
 * @fileOverview Supabase query-builder API with a Firestore-compatible surface (backed by PostgREST).
 *
 * Provides collection/query/doc helpers used throughout the app:
 *   collection, query, where, orderBy, doc, serverTimestamp, increment,
 *   arrayUnion, arrayRemove, documentId, getDoc
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Internal descriptor types ───────────────────────────────────────────────

export interface FilterItem {
  column: string;
  op: 'eq' | 'neq' | 'in' | 'contains' | 'jsonb_contains' | 'gt' | 'gte' | 'lt' | 'lte';
  value: any;
  negate?: boolean;
}

export interface SupabaseQuery {
  __memo?: boolean;
  __type: 'collection';
  client: SupabaseClient;
  table: string;
  filters: FilterItem[];
  ordering?: { column: string; ascending: boolean };
  /** Path string used for error messages */
  path: string;
}

export interface SupabaseDocRef {
  __memo?: boolean;
  __type: 'doc';
  client: SupabaseClient;
  table: string;
  id: string;
  path: string;
}

export interface CollectionRef {
  client: SupabaseClient;
  table: string;
  /** Implicit filters injected by sub-collection notation */
  implicitFilters?: FilterItem[];
}

// ─── Special value sentinels ─────────────────────────────────────────────────

export interface IncrementValue {
  __special: 'increment';
  amount: number;
}

export interface ArrayUnionValue {
  __special: 'arrayUnion';
  elements: any[];
}

export interface ArrayRemoveValue {
  __special: 'arrayRemove';
  elements: any[];
}

/** Mirrors the increment() API sentinel */
export function increment(n: number): IncrementValue {
  return { __special: 'increment', amount: n };
}

/** Mirrors the arrayUnion() API sentinel */
export function arrayUnion(...elements: any[]): ArrayUnionValue {
  return { __special: 'arrayUnion', elements };
}

/** Mirrors the arrayRemove() API sentinel */
export function arrayRemove(...elements: any[]): ArrayRemoveValue {
  return { __special: 'arrayRemove', elements };
}

/** Returns an ISO timestamp string — used as serverTimestamp() equivalent for non-blocking writes. */
export function serverTimestamp(): string {
  return new Date().toISOString();
}

// ─── FieldPath (documentId()) ────────────────────────────────────────────────

class DocumentIdPath {
  readonly __isDocumentId = true;
}

/** Returns a sentinel for filtering by document ID */
export function documentId(): DocumentIdPath {
  return new DocumentIdPath();
}

// ─── Query constraints ────────────────────────────────────────────────────────

export interface QueryConstraint {
  apply(q: SupabaseQuery): void;
}

/** Builds a filter constraint for query() */
export function where(
  field: string | DocumentIdPath,
  op: '==' | 'in' | 'array-contains' | '!=' | 'not-in' | '>' | '>=' | '<' | '<=',
  value: any,
): QueryConstraint {
  return {
    apply(q: SupabaseQuery) {
      // documentId() → filter by 'id' column
      if (field instanceof DocumentIdPath || (field as any).__isDocumentId) {
        q.filters.push({ column: 'id', op: 'in', value: Array.isArray(value) ? value : [value] });
        return;
      }
      const col = field as string;

      // Dynamic unread_<uid> fields live in the JSONB column `unread_state`
      if (col.startsWith('unread_')) {
        const uid = col.slice('unread_'.length);
        q.filters.push({ column: 'unread_state', op: 'jsonb_contains', value: { [uid]: value } });
        return;
      }

      if (op === '==') {
        q.filters.push({ column: col, op: 'eq', value });
      } else if (op === '!=') {
        q.filters.push({ column: col, op: 'neq', value });
      } else if (op === 'in' || op === 'not-in') {
        q.filters.push({
          column: col,
          op: 'in',
          value: Array.isArray(value) ? value : [value],
          negate: op === 'not-in',
        });
      } else if (op === 'array-contains') {
        q.filters.push({ column: col, op: 'contains', value });
      } else if (op === '>') {
        q.filters.push({ column: col, op: 'gt', value });
      } else if (op === '>=') {
        q.filters.push({ column: col, op: 'gte', value });
      } else if (op === '<') {
        q.filters.push({ column: col, op: 'lt', value });
      } else if (op === '<=') {
        q.filters.push({ column: col, op: 'lte', value });
      }
    },
  };
}

/** Builds an ordering constraint for query() */
export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): QueryConstraint {
  return {
    apply(q: SupabaseQuery) {
      q.ordering = { column: field, ascending: direction === 'asc' };
    },
  };
}

// ─── collection() / query() / doc() ──────────────────────────────────────────

/**
 * Builds a CollectionRef for a Supabase table.
 *
 * Also handles sub-collection syntax:
 *   collection(db, 'chats', chatId, 'messages')
 * → table: 'messages', implicit filter: chatId = chatId
 */
export function collection(client: SupabaseClient, ...pathSegments: string[]): CollectionRef {
  if (pathSegments.length === 3) {
    // e.g. collection(db, 'chats', chatId, 'messages')
    const [, parentId, childTable] = pathSegments;
    return {
      client,
      table: childTable,
      implicitFilters: [{ column: 'chatId', op: 'eq', value: parentId }],
    };
  }
  return { client, table: pathSegments[0] };
}

/** Builds a SupabaseQuery descriptor from a CollectionRef and constraints */
export function query(ref: CollectionRef, ...constraints: QueryConstraint[]): SupabaseQuery {
  const q: SupabaseQuery = {
    __type: 'collection',
    client: ref.client,
    table: ref.table,
    filters: [...(ref.implicitFilters ?? [])],
    path: ref.table,
  };
  for (const c of constraints) c.apply(q);
  return q;
}

/** Creates a SupabaseDocRef for a specific row */
export function doc(client: SupabaseClient, table: string, id: string): SupabaseDocRef {
  return {
    __type: 'doc',
    client,
    table,
    id,
    path: `${table}/${id}`,
  };
}

// ─── One-shot read: getDoc() ───────────────────────────────────────────────────

export interface DocSnapshot {
  exists(): boolean;
  data(): any | null;
  id: string;
}

/**
 * One-time fetch for a single row — returns a snapshot object.
 */
export async function getDoc(ref: SupabaseDocRef): Promise<DocSnapshot> {
  const { data, error } = await ref.client
    .from(ref.table)
    .select('*')
    .eq('id', ref.id)
    .maybeSingle();

  if (error) {
    console.error(`getDoc error (${ref.path}):`, error.message);
  }

  return {
    exists: () => !error && data != null,
    data: () => data ?? null,
    id: ref.id,
  };
}

// ─── Internal helpers used by hooks ──────────────────────────────────────────

/** Apply all filters/ordering from a SupabaseQuery descriptor to a Supabase query builder. */
export function applyFilters(
  builder: ReturnType<ReturnType<SupabaseClient['from']>['select']>,
  q: SupabaseQuery,
): ReturnType<ReturnType<SupabaseClient['from']>['select']> {
  let b = builder as any;

  for (const filter of q.filters) {
    if (filter.op === 'eq') {
      b = b.eq(filter.column, filter.value);
    } else if (filter.op === 'neq') {
      b = b.neq(filter.column, filter.value);
    } else if (filter.op === 'in') {
      const vals = Array.isArray(filter.value) ? filter.value : [filter.value];
      if (vals.length === 0) {
        // Return nothing — simulate empty result
        b = b.eq('id', '__NO_MATCH__');
      } else if (filter.negate) {
        b = b.not(filter.column, 'in', `(${vals.map((v: any) => `"${v}"`).join(',')})`);
      } else {
        b = b.in(filter.column, vals);
      }
    } else if (filter.op === 'contains') {
      // PostgreSQL array @> operator
      b = b.contains(filter.column, [filter.value]);
    } else if (filter.op === 'jsonb_contains') {
      // JSONB @> operator via PostgREST `cs` (containedBy is `cd`; contains is `cs`)
      b = b.contains(filter.column, filter.value);
    } else if (filter.op === 'gt') {
      b = b.gt(filter.column, filter.value);
    } else if (filter.op === 'gte') {
      b = b.gte(filter.column, filter.value);
    } else if (filter.op === 'lt') {
      b = b.lt(filter.column, filter.value);
    } else if (filter.op === 'lte') {
      b = b.lte(filter.column, filter.value);
    }
  }

  if (q.ordering) {
    b = b.order(q.ordering.column, { ascending: q.ordering.ascending });
  }

  return b;
}

/** Wrap an ISO timestamp string into a Timestamp-compatible object { toDate(), seconds, nanoseconds }. */
export function wrapTimestamp(isoString: string): { toDate(): Date; seconds: number; nanoseconds: number } {
  const date = new Date(isoString);
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.Z+-]+$/;

/**
 * Transform a raw Supabase row so that:
 *  - ISO timestamp strings become Timestamp-compatible objects { toDate() }
 *  - `unread_state` JSONB is spread into the row (gives chat.`unread_<uid>` keys)
 */
export function transformRow(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object') return row;
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === 'unread_state' && value !== null && typeof value === 'object') {
      // Spread JSONB unread flags — gives chat[`unread_${uid}`] = true/false
      Object.assign(result, value);
    } else if (typeof value === 'string' && ISO_RE.test(value)) {
      result[key] = wrapTimestamp(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}
