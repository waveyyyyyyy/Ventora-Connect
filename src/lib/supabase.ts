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


// Keep a module-wide view of the auth client state. Supabase emits INITIAL_SESSION
// after it hydrates local storage; this listener never performs auth/network work.
let observedAuthUser: import('@supabase/supabase-js').User | null = null;
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) observedAuthUser = session.user;
    else if (event === 'SIGNED_OUT') observedAuthUser = null;
  });
}

// Resolve the already-persisted session without rotating refresh tokens.
// Navigation and route mounts must never compete to refresh the same token.
let restoreInFlight: Promise<import('@supabase/supabase-js').User | null> | null = null;
export function restoreUserSession(): Promise<import('@supabase/supabase-js').User | null> {
  if (!supabase) return Promise.resolve(null);
  if (restoreInFlight) return restoreInFlight;

  restoreInFlight = (async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session?.user) {
        observedAuthUser = data.session.user;
        return data.session.user;
      }

      // A route can mount during a brief empty-session event while the auth
      // client is hydrating. Prefer the user already observed by the shared
      // client, then use getUser (the same fallback used by the workspace).
      if (observedAuthUser) return observedAuthUser;

      const { data: verified, error: verifyError } = await supabase.auth.getUser();
      if (!verifyError && verified.user) {
        observedAuthUser = verified.user;
        return verified.user;
      }
      return observedAuthUser;
    } catch {
      return observedAuthUser;
    }
  })().finally(() => {
    restoreInFlight = null;
  });

  return restoreInFlight;
}

export type MessagingProfileCheck = { complete: boolean; missing: string[]; percent: number };
export async function checkMessagingProfile(userId: string): Promise<MessagingProfileCheck> {
  if (!supabase) return { complete: false, missing: ['Account connection'], percent: 0 };
  const { data: profile, error } = await supabase.from('profiles')
    .select('account_type,full_name,bio,city,country,website')
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
      ['Minimum investment', data?.investment_min != null],
      ['Maximum investment', data?.investment_max != null],
      ['Preferred industries', Boolean(data?.preferred_industries?.length)],
      ['Preferred stages', Boolean(data?.preferred_stages?.length)],
      ['Investment strategy', Boolean(data?.investment_strategy?.trim())],
    );
  } else {
    const { data } = await supabase.from('discoverable_businesses')
      .select('company_name,industry,description,city,country,business_stage,business_model,funding_requirement')
      .eq('owner_id', userId).limit(1).maybeSingle();
    fields.push(
      ['Published company name', Boolean(data?.company_name?.trim())],
      ['Company industry', Boolean(data?.industry?.trim())],
      ['Company overview', Boolean(data?.description?.trim())],
      ['Company location', Boolean(data?.city?.trim() && data?.country?.trim())],
      ['Business stage', Boolean(data?.business_stage?.trim())],
      ['Business model', Boolean(data?.business_model?.trim())],
      ['Funding requirement', data?.funding_requirement != null],
    );
  }
  const missing = fields.filter(([, ok]) => !ok).map(([label]) => label);
  const percent = Math.round(((fields.length - missing.length) / fields.length) * 100);
  return { complete: missing.length === 0, missing, percent };
}
