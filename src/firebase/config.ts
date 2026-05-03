/**
 * Supabase project configuration.
 * Exported for use in sitemap.ts and other server-side utilities.
 */
export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

/**
 * @deprecated Kept for backward compatibility with sitemap.ts
 * which previously used firebaseConfig.projectId.
 */
export const firebaseConfig = {
  projectId: supabaseConfig.url.replace('https://', '').split('.')[0],
};
