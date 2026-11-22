import { createClient, type User } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)
  || 'https://nlkcnewcrcgylubqulph.supabase.co';
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  || 'sb_publishable_nJm5OWA2sXxIfAEQpuQ4Xw_YUQrWCer';

type DiagnosticEvent = { kind: string; message: string; source?: string; status?: number };
let diagnosticSink: ((event: DiagnosticEvent) => void) | null = null;
export function setDiagnosticCapture(sink: ((event: DiagnosticEvent) => void) | null) { diagnosticSink = sink; }
const diagnosticFetch: typeof fetch = async (input, init) => {
  const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET')).toUpperCase();
  const safePath = (() => { try { return new URL(rawUrl, url).pathname; } catch { return '[unknown path]'; } })();
  try {
    const response = await globalThis.fetch(input, init);
    if (!response.ok) diagnosticSink?.({ kind: 'Supabase/API request failed', message: method + ' ' + safePath + ' returned HTTP ' + response.status, source: 'Supabase', status: response.status });
    return response;
  } catch (error) {
    diagnosticSink?.({ kind: 'Supabase/API network failure', message: method + ' ' + safePath + ': ' + (error instanceof Error ? error.message : 'Network request failed'), source: 'Supabase' });
    throw error;
  }
};
export const isSupabaseConfigured = Boolean(url && key);
export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      global: { fetch: diagnosticFetch },
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
let cachedAuthUser: User | null = null;
const initialAuthReady = new Promise<void>((resolve) => {
  resolveInitialAuth = resolve;
});
let restoreInFlight: Promise<User | null> | null = null;

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) cachedAuthUser = session.user;
    if (event === 'SIGNED_OUT') cachedAuthUser = null;
    if (event === 'INITIAL_SESSION' && !initialAuthResolved) {
      initialAuthResolved = true;
      resolveInitialAuth();
    }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      authEpoch += 1;
      restoreInFlight = null;
    }
  });
}

/**
 * Restore the locally persisted Supabase session.
 *
 * Supabase Auth owns refresh-token rotation and cross-tab coordination.
 * Do not manually call refreshSession() here: repeated manual refreshes from
 * route guards and auth listeners can race the SDK's own refresh, consume
 * rotating refresh tokens, and trigger Auth rate limits.
 *
 * getSession() reads the SDK-managed persisted session and lets the SDK handle
 * expiry/refresh. RLS remains the authority for every private database action.
 */
export function restoreUserSession(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  if (cachedAuthUser) return Promise.resolve(cachedAuthUser);
  if (restoreInFlight) return restoreInFlight;

  const epoch = authEpoch;
  const task = (async (): Promise<User | null> => {
    if (!initialAuthResolved) {
      await Promise.race([
        initialAuthReady,
        new Promise<void>((resolve) => window.setTimeout(resolve, 10000)),
      ]);
    }
    if (epoch !== authEpoch) return cachedAuthUser;
    if (cachedAuthUser) return cachedAuthUser;
    try {
      // One SDK-managed read only. Supabase owns token refresh and persistence;
      // callers must never force refreshSession() as a side effect of routing.
      const { data, error } = await supabase.auth.getSession();
      if (epoch !== authEpoch) return cachedAuthUser;
      if (error) return null;
      const user = data.session?.user || null;
      if (user) cachedAuthUser = user;
      return user;
    } catch {
      // A storage/network error is not proof that the member signed out.
      return null;
    }
  })();

  restoreInFlight = task;
  void task.finally(() => {
    if (restoreInFlight === task) restoreInFlight = null;
  });
  return task;
}

/**
 * Compatibility helper for message requests that need one retry after an auth
 * error. It reads the SDK-managed session; it deliberately does not force a
 * refresh, so it cannot compete with Supabase's token rotation.
 */
export async function refreshVerifiedSession(expectedUserId?: string) {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token || !data.session.user?.id) return null;
  if (expectedUserId && data.session.user.id !== expectedUserId) return null;
  cachedAuthUser = data.session.user;
  return { user: data.session.user, session: data.session };
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  authEpoch += 1;
  restoreInFlight = null;
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw error;
  cachedAuthUser = null;
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
