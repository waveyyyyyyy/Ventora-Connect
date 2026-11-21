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


// Restore the persisted member before any route is allowed to show a sign-in gate.
// Supabase can briefly return an empty local session while its auth client is
// initialising; verify with getUser and refresh before treating the member as signed out.
export async function restoreUserSession() {
  if (!supabase) return null;
  try {
    const current = await supabase.auth.getSession();
    if (current.data.session?.user) return current.data.session.user;
    const verified = await supabase.auth.getUser();
    if (verified.data.user) return verified.data.user;
    const refreshed = await supabase.auth.refreshSession();
    if (refreshed.data.session?.user) return refreshed.data.session.user;
    const finalCheck = await supabase.auth.getUser();
    return finalCheck.data.user || null;
  } catch {
    return null;
  }
}
