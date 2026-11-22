import { createClient, type Session, type User } from '@supabase/supabase-js';
import { retainCachedSessionOnUnexpectedSignOut } from './auth-session-policy.mjs';

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

// A cached Session (rather than a bare User) keeps the member interface stable
// during a transient SDK refresh failure. Protected actions must still call
// requireActiveSession() before performing account-setup writes.
const STORAGE_KEY = 'sb-nlkcnewcrcgylubqulph-auth-token';
let cachedAuthSession: Session | null = null;
let manualSignOutPending = false;
let restoreInFlight: Promise<User | null> | null = null;
let verifiedSessionInFlight: Promise<{ user: User; session: Session } | null> | null = null;

function readStoredSessionSnapshot(): Session | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return saved?.access_token && saved?.refresh_token && saved?.user?.id
      ? saved as Session
      : null;
  } catch {
    return null;
  }
}

cachedAuthSession = readStoredSessionSnapshot();

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.access_token && session.user?.id) {
      cachedAuthSession = session;
    } else if (event === 'SIGNED_OUT') {
      if (!retainCachedSessionOnUnexpectedSignOut(manualSignOutPending, cachedAuthSession)) {
        cachedAuthSession = null;
      }
    }
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      restoreInFlight = null;
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue === null) {
        cachedAuthSession = null;
        restoreInFlight = null;
        verifiedSessionInFlight = null;
      } else {
        cachedAuthSession = readStoredSessionSnapshot();
      }
    });
  }
}

/**
 * Return the last known member identity for UI continuity. The cached Session
 * is never treated as proof for a sensitive write: those call requireActiveSession.
 * Supabase Auth remains responsible for rotating and persisting refresh tokens.
 */
export function restoreUserSession(): Promise<User | null> {
  if (!supabase) return Promise.resolve(null);
  if (cachedAuthSession?.user?.id) return Promise.resolve(cachedAuthSession.user);
  if (restoreInFlight) return restoreInFlight;

  const task = (async (): Promise<User | null> => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (data.session?.access_token && data.session.user?.id) {
        cachedAuthSession = data.session;
        return data.session.user;
      }
      // Do not convert a temporary SDK/network error into a UI sign-out.
      if (cachedAuthSession?.user?.id) return cachedAuthSession.user;
      if (error) return null;
      return null;
    } catch {
      return cachedAuthSession?.user ?? null;
    }
  })();

  restoreInFlight = task;
  void task.finally(() => {
    if (restoreInFlight === task) restoreInFlight = null;
  });
  return task;
}

/**
 * Verify a session before sensitive setup actions. getSession() delegates
 * expiry handling to the SDK; this helper never calls refreshSession() itself.
 */
export async function requireActiveSession(expectedUserId?: string): Promise<Session> {
  if (!supabase) throw new Error('Authentication is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session?.access_token || !session.user?.id) {
    throw new Error('Your saved sign-in is reconnecting. Please wait a moment and try again. You have not been signed out.');
  }
  if (expectedUserId && session.user.id !== expectedUserId) {
    throw new Error('The active sign-in belongs to a different account. Please retry after the session finishes restoring.');
  }
  const { data: verified, error: verifyError } = await supabase.auth.getUser(session.access_token);
  if (verifyError || verified.user?.id !== session.user.id) {
    throw new Error('Your sign-in is temporarily unavailable. Please wait a moment and try again.');
  }
  cachedAuthSession = session;
  return session;
}

/**
 * Parallel message requests share one session-recovery attempt. This prevents
 * a batch of expired-JWT failures from launching competing refresh requests.
 */
export function refreshVerifiedSession(expectedUserId?: string) {
  if (!supabase) return Promise.resolve(null);
  if (!verifiedSessionInFlight) {
    const task = (async (): Promise<{ user: User; session: Session } | null> => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data.session;
        if (error || !session?.access_token || !session.user?.id) return null;
        const { data: verified, error: verifyError } = await supabase.auth.getUser(session.access_token);
        if (verifyError || verified.user?.id !== session.user.id) return null;
        cachedAuthSession = session;
        return { user: session.user, session };
      } catch {
        return null;
      }
    })();
    verifiedSessionInFlight = task;
    void task.finally(() => {
      if (verifiedSessionInFlight === task) verifiedSessionInFlight = null;
    });
  }
  return verifiedSessionInFlight.then((result) => {
    if (!result || (expectedUserId && result.user.id !== expectedUserId)) return null;
    return result;
  });
}

export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  manualSignOutPending = true;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    cachedAuthSession = null;
    restoreInFlight = null;
    verifiedSessionInFlight = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem('ventora-google-oauth-pending');
      window.localStorage.removeItem('ventora-google-oauth-role');
      window.sessionStorage.removeItem('ventora-google-oauth-pending');
      window.sessionStorage.removeItem('ventora-google-oauth-role');
    } catch {
      // Supabase sign-out has completed; storage cleanup is best effort.
    }
  } finally {
    manualSignOutPending = false;
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
