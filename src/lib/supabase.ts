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


// Track Supabase's initial persisted-session hydration centrally. A route can
// mount before getSession() has finished reading local storage; waiting for
// INITIAL_SESSION avoids mistaking that temporary empty read for a signed-out user.
let observedAuthUser: import('@supabase/supabase-js').User | null = null;
let observedAuthSession: import('@supabase/supabase-js').Session | null = null;
let initialAuthResolved = false;
let resolveInitialAuth!: () => void;
const initialAuthReady = new Promise<void>((resolve) => {
  resolveInitialAuth = resolve;
});

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      observedAuthUser = session.user;
      observedAuthSession = session;
    } else if (event === 'SIGNED_OUT') {
      observedAuthUser = null;
      observedAuthSession = null;
    }

    if (event === 'INITIAL_SESSION' && !initialAuthResolved) {
      initialAuthResolved = true;
      resolveInitialAuth();
    }
  });
}

// All protected routes share this single restoration path. It waits for the
// auth client's initial local-storage hydration before reading the session,
// preventing Messages and the directory from racing Supabase startup.
let restoreInFlight: Promise<import('@supabase/supabase-js').User | null> | null = null;
export function restoreUserSession(): Promise<import('@supabase/supabase-js').User | null> {
  if (!supabase) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    if (observedAuthSession?.user) return observedAuthSession.user;

    if (!initialAuthResolved) {
      await Promise.race([
        initialAuthReady,
        new Promise<void>((resolve) => window.setTimeout(resolve, 6000)),
      ]);
    }

    if (observedAuthSession?.user) return observedAuthSession.user;

    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        observedAuthSession = data.session;
        observedAuthUser = data.session.user;
        return data.session.user;
      }
    } catch {
      // Continue to the verified-user fallback below.
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data.user) {
        observedAuthUser = data.user;
        return data.user;
      }
    } catch {
      // A failed verification is not treated as an explicit sign-out event.
    }

    return observedAuthSession?.user || observedAuthUser;
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
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
