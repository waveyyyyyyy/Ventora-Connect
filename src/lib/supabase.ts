import { createClient, type Session, type User } from '@supabase/supabase-js';

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

// A cached User object alone does not mean the current PostgREST request will
// carry a valid JWT. All private routes use this shared, server-verified gate.
let initialAuthResolved = false;
let resolveInitialAuth!: () => void;
let authEpoch = 0;
const initialAuthReady = new Promise<void>((resolve) => {
  resolveInitialAuth = resolve;
});
let restoreInFlight: Promise<User | null> | null = null;
let refreshInFlight: Promise<Session | null> | null = null;

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' && !initialAuthResolved) {
      initialAuthResolved = true;
      resolveInitialAuth();
    }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      authEpoch += 1;
      restoreInFlight = null;
      refreshInFlight = null;
    }
  });
}

function matchesSession(session: Session | null, expectedUserId?: string): boolean {
  return Boolean(session?.access_token && session.user?.id
    && (!expectedUserId || session.user.id === expectedUserId));
}

/** Serialize refresh-token rotation and verify that the same account is active. */
export async function refreshVerifiedSession(expectedUserId?: string): Promise<Session | null> {
  if (!supabase) return null;
  if (refreshInFlight) {
    const shared = await refreshInFlight;
    return matchesSession(shared, expectedUserId) ? shared : null;
  }

  const epoch = authEpoch;
  const task = (async (): Promise<Session | null> => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (epoch !== authEpoch || error || !matchesSession(data.session, expectedUserId)) return null;
      const { data: verified, error: verifyError } = await supabase.auth.getUser();
      if (epoch !== authEpoch || verifyError || verified.user?.id !== data.session.user.id) return null;
      const { data: latest, error: latestError } = await supabase.auth.getSession();
      if (epoch !== authEpoch || latestError || !matchesSession(latest.session, expectedUserId)
        || latest.session.user.id !== verified.user.id) return null;
      return latest.session;
    } catch {
      return null;
    }
  })();

  refreshInFlight = task;
  try {
    return await task;
  } finally {
    if (refreshInFlight === task) refreshInFlight = null;
  }
}

/**
 * The only session restoration path for private screens. A local User without
 * its matching Auth-verified session is never allowed to run private queries.
 */
export function restoreUserSession(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;

  const epoch = authEpoch;
  const task = (async (): Promise<User | null> => {
    const current = () => epoch === authEpoch;
    if (!initialAuthResolved) {
      await Promise.race([
        initialAuthReady,
        new Promise<void>((resolve) => window.setTimeout(resolve, 10000)),
      ]);
    }
    if (!current()) return null;

    // Android WebViews can hydrate local storage shortly after the first paint.
    // Retry safely and verify every accepted session with the Auth server.
    for (const delay of [0, 350, 800, 1300]) {
      if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
      if (!current()) return null;

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!current()) return null;
        const session = error ? null : data.session;

        if (matchesSession(session)) {
          const { data: verified, error: verifyError } = await supabase.auth.getUser();
          if (!current()) return null;
          if (!verifyError && verified.user?.id === session.user.id) {
            const { data: latest, error: latestError } = await supabase.auth.getSession();
            if (!current()) return null;
            if (!latestError && matchesSession(latest.session, verified.user.id)
              && latest.session.user.id === verified.user.id) return verified.user;
          }
          const refreshed = await refreshVerifiedSession(session.user.id);
          if (current() && refreshed) return refreshed.user;
        } else {
          const refreshed = await refreshVerifiedSession();
          if (current() && refreshed) return refreshed.user;
        }
      } catch {
        // Keep the current UI identity intact during transient storage/network races.
      }
    }
    return null;
  })();

  restoreInFlight = task;
  void task.finally(() => {
    if (restoreInFlight === task) restoreInFlight = null;
  });
  return task;
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  authEpoch += 1;
  restoreInFlight = null;
  refreshInFlight = null;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
  initialAuthResolved = true;
  resolveInitialAuth();

  try {
    window.localStorage.removeItem('sb-nlkcnewcrcgylubqulph-auth-token');
    window.localStorage.removeItem('ventora-google-oauth-pending');
    window.localStorage.removeItem('ventora-google-oauth-role');
    window.sessionStorage.removeItem('ventora-google-oauth-pending');
    window.sessionStorage.removeItem('ventora-google-oauth-role');
  } catch {
    // Supabase sign-out has completed; storage cleanup is best effort.
  }
}

export type MessagingProfileCheck = { complete: boolean; missing: string[]; percent: number };

export async function checkMessagingProfile(userId: string): Promise<MessagingProfileCheck> {
  if (!supabase) return { complete: false, missing: ['Account connection'], percent: 0 };
  const current = await restoreUserSession();
  if (!current || current.id !== userId) {
    return { complete: false, missing: ['Verified sign-in'], percent: 0 };
  }

  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('account_type,full_name,bio,city,country')
    .eq('id', userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) return { complete: false, missing: ['Personal profile'], percent: 0 };

  const fields: Array<[string, boolean]> = [
    ['Full name', Boolean(profile.full_name?.trim())],
    ['Bio / introduction', Boolean(profile.bio?.trim())],
    ['City', Boolean(profile.city?.trim())],
    ['Country', Boolean(profile.country?.trim())],
  ];

  if (profile.account_type === 'investor') {
    const { data, error } = await supabase.from('investors')
      .select('investment_min,investment_max,preferred_industries,preferred_stages')
      .eq('id', userId).maybeSingle();
    if (error) throw error;
    fields.push(
      ['Investment range', data?.investment_min != null || data?.investment_max != null],
      ['Preferred industries', Boolean(data?.preferred_industries?.length)],
      ['Preferred stages', Boolean(data?.preferred_stages?.length)],
    );
  } else {
    const { data, error } = await supabase.from('businesses')
      .select('company_name,industry,description')
      .eq('owner_id', userId).order('created_at', { ascending: false }).limit(10);
    if (error) throw error;
    const rows = data || [];
    const business = rows.find((row) => row.company_name?.trim()
      && row.industry?.trim() && row.description?.trim()) || rows[0];
    fields.push(
      ['Company name', Boolean(business?.company_name?.trim())],
      ['Company industry', Boolean(business?.industry?.trim())],
      ['Company overview', Boolean(business?.description?.trim())],
    );
  }

  const missing = fields.filter(([, ok]) => !ok).map(([label]) => label);
  const percent = Math.round(((fields.length - missing.length) / fields.length) * 100);
  return { complete: missing.length === 0, missing, percent };
}
