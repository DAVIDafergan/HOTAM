// Other people's seller/customer rows are read through safe-column views (security Phase B:
// docs/security-phase-b-1-additive.sql). The base tables become owner/admin-only once
// docs/security-phase-b-2-lockdown.sql runs. Until part 1 has run, the views don't exist yet,
// so every read here falls back to the base table — the code works before and after the migration.

export const PUBLIC_VIEW_BASE_TABLE: Record<string, string> = {
  sellers_public: 'sellers',
  customers_public: 'customers',
};

/** PostgREST / Postgres "no such table or view" (the view not created yet). */
export function isMissingRelationError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /relation .* does not exist|could not find the table/i.test(error.message || '')
  );
}

type Result<T> = { data: T | null; error: any; count?: number | null };

/**
 * Runs `build` against a public view, retrying against its base table if the view is missing.
 * `build` receives `client.from(<name>)` and the name it's reading (view or base table).
 */
export async function fromPublicView<T = any>(
  client: any,
  view: keyof typeof PUBLIC_VIEW_BASE_TABLE,
  build: (from: any, name: string) => PromiseLike<Result<T>>,
): Promise<Result<T>> {
  const first = await build(client.from(view), view);
  if (!isMissingRelationError(first.error)) return first;
  const base = PUBLIC_VIEW_BASE_TABLE[view];
  return build(client.from(base), base);
}
