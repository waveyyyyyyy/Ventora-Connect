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
// Supabase may still be hydrating local storage when a mobile route mounts.
// Wait for its initial auth event and retry session reads before attempting
// a single refresh, so concurrent route mounts cannot race refresh-token rotation.
let restoreInFlight: Promise<import('@supabase/supabase-js').User | null> | null = null;
export function restoreUserSession(): Promise<import('@supabase/supabase-js').User | null> {
  if (!supabase) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    let eventUser: import('@supabase/supabase-js').User | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) eventUser = session.user;
    });

    try {
      // Let the auth client's INITIAL_SESSION hydration finish if it is in flight.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        if (eventUser) return eventUser;
        const { data, error } = await supabase.auth.getSession();
        if (data.session?.user) return data.session.user;

        // A refresh is attempted once, after several reads have allowed storage
        // hydration to settle. Never clear persisted auth on a failed refresh.
        if (attempt === 3) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.data.session?.user) return refreshed.data.session.user;
        }

        if (attempt < 5) {
          await new Promise(resolve => window.setTimeout(resolve, 350));
        }
      }

      if (eventUser) return eventUser;
      const verified = await supabase.auth.getUser();
      if (!verified.error && verified.data.user) return verified.data.user;
      return null;
    } catch {
      return eventUser;
    } finally {
      subscription.unsubscribe();
    }
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
}
