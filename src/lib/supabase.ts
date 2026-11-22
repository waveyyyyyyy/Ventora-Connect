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


// Keep one authoritative view of the active Supabase session. A user object
// without its matching session is not enough: PostgREST would still send the
// request as anon and protected membership queries would fail.
let initialAuthResolved = false;
let resolveInitialAuth!: () => void;
let authEpoch = 0;
const initialAuthReady = new Promise<void>((resolve) => {
  resolveInitialAuth = resolve;
});

if (supabase) {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' && !initialAuthResolved) {
      initialAuthResolved = true;
      resolveInitialAuth();
    }
  });
}

// All protected routes share this restoration path. A generation counter
// prevents an older in-flight restore from returning a user after sign-out.
let restoreInFlight: Promise<import('@supabase/supabase-js').User | null> | null = null;
export function restoreUserSession(): Promise<import('@supabase/supabase-js').User | null> {
  if (!supabase) return Promise.resolve(null);
  // Always read the live Supabase session before returning a user. A cached
  // user object alone can outlive its access token and cause PostgREST to send
  // protected queries as anon (401/42501) during mobile session restoration.
  if (restoreInFlight) return restoreInFlight;

  const epoch = authEpoch;
  const task = (async () => {
    const stillCurrent = () => epoch === authEpoch;
    if (!initialAuthResolved) {
      await Promise.race([
        initialAuthReady,
        new Promise<void>((resolve) => window.setTimeout(resolve, 10000)),
      ]);
    }
    if (!stillCurrent()) return null;

    // Recheck mobile storage hydration a few times, but only accept a user
    // when Supabase also has the matching access-token session.
    const delays = [0, 400, 900, 1400];
    for (const delay of delays) {
      if (delay) await new Promise<void>((resolve) => window.setTimeout(resolve, delay));
      if (!stillCurrent()) return null;

      try {
        const { data, error } = await supabase.auth.getSession();
        if (!stillCurrent()) return null;
        if (!error && data.session?.user) {
          return data.session.user;
        }
      } catch {
        // Continue to the server-verified fallback.
      }

      try {
        const { data, error } = await supabase.auth.getUser();
        if (!stillCurrent()) return null;
        if (!error && data.user) {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          if (!stillCurrent()) return null;
          if (!sessionError && sessionData.session?.user?.id === data.user.id) {
            return sessionData.session.user;
          }
        }
      } catch {
        // Retry while the persisted session finishes restoring.
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

// One sign-out path for every navigation surface. Local scope clears this
// device's session without revoking other devices, and pending OAuth flags
// cannot accidentally send the next visit through an old callback.
export async function signOutUser(): Promise<void> {
  if (!supabase) return;
  authEpoch += 1;
  restoreInFlight = null;

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
    // The Supabase sign-out already completed; storage cleanup is best effort.
  }
}

export type MessagingProfileCheck = { complete: boolean; missing: string[]; percent: number };
export async function checkMessagingProfile(userId: string): Promise<MessagingProfileCheck> {
  if (!supabase) return { complete: false, missing: ['Account connection'], percent: 0 };
  const { data: profile, error } = await supabase.from('profiles')
    .select('account_type,full_name,bio,city,country')
    .eq('id', userId).maybeSingle();
  if (error || !profile) return { complete: false, missing: ['Personal profile'], percent: 0 };
  const fields: Array<[string, boolean]> = [
    ['Full name', Boolean(profile.full_name?.trim())],
    ['Bio / introduction', Boolean(profile.bio?.trim())],
    ['City', Boolean(profile.city?.trim())],
    ['Country', Boolean(profile.country?.trim())],
  ];
  if (profile.account_type === 'investor') {
    const { data } = await supabase.from('investors')
      .select('investment_min,investment_max,preferred_industries,preferred_stages,investment_strategy')
      .eq('id', userId).maybeSingle();
    fields.push(
      ['Investment range', data?.investment_min != null || data?.investment_max != null],
      ['Preferred industries', Boolean(data?.preferred_industries?.length)],
      ['Preferred stages', Boolean(data?.preferred_stages?.length)],
    );
  } else {
    // Read the owner's editable business record, not the public discoverable
    // view (which can hide unpublished drafts and make 100% impossible).
    const { data } = await supabase.from('businesses')
      .select('company_name,industry,description')
      .eq('owner_id', userId).limit(1).maybeSingle();
    fields.push(
      ['Company name', Boolean(data?.company_name?.trim())],
      ['Company industry', Boolean(data?.industry?.trim())],
      ['Company overview', Boolean(data?.description?.trim())],
    );
  }
  const missing = fields.filter(([, ok]) => !ok).map(([label]) => label);
  const percent = Math.round(((fields.length - missing.length) / fields.length) * 100);
  return { complete: missing.length === 0, missing, percent };
}
