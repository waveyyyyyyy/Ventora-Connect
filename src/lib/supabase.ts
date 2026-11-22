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
      const { data, error } = await supabase.auth.getSession();
      if (data.session?.user) return data.session.user;
      // A transient getSession error can occur while the browser is restoring
      // or refreshing a persisted session. Verify before treating the member
      // as signed out; never let a temporary read failure redirect them away.
      const verified = await supabase.auth.getUser();
      if (!verified.error && verified.data.user) return verified.data.user;
      if (error) {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session?.user) return refreshed.data.session.user;
      }
      return null;
    } catch {
      return null;
    }
  })().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}
