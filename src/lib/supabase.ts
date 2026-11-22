import { createClient } from '@supabase/supabase-js';

// Publishable keys are designed for browser use. These fallbacks let the
// StackBlitz preview connect without requiring a local .env file.
// Environment variables still take priority for other deployments.
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://nlkcnewcrcgylubqulph.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || 'sb_publishable_nJm5OWA2sXxIfAEQpuQ4Xw_YUQrWCer';

export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'sb-nlkcnewcrcgylubqulph-auth-token',
      },
    })
  : null;


// Restore a persisted member through one shared in-flight check.
// Several routes can mount together; sharing this promise prevents parallel
// refresh attempts from racing and invalidating the same rotating refresh token.
let restoreInFlight: Promise<import('@supabase/supabase-js').User | null> | null = null;
export function restoreUserSession(): Promise<import('@supabase/supabase-js').User | null> {
  if (!supabase) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = (async () => {
    try {
      // First trust the persisted Supabase session. Do not call signOut or
      // clear storage as a side effect of a temporary restoration failure.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;

      // If storage hydration is still catching up, verify the current user.
      const verified = await supabase.auth.getUser();
      if (!verified.error && verified.data.user) return verified.data.user;

      // A missing session can be a transient refresh-token race on mobile.
      // Try one refresh before any caller treats the visitor as signed out.
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error && refreshed.data.session?.user) return refreshed.data.session.user;

      return null;
    } catch {
      return null;
    }
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}
