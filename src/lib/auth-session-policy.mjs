/**
 * Small, pure auth decisions shared by the app and its regression tests.
 * Keep these rules independent of the Supabase client so they can be tested
 * without network access or a live account.
 */
export function retainCachedSessionOnUnexpectedSignOut(manualSignOutPending, cachedSession) {
  return !manualSignOutPending && Boolean(cachedSession?.access_token && cachedSession?.user?.id);
}

export function shouldOfferRoleSelection(profileResult, user) {
  if (!profileResult || profileResult.error) return false;
  const metadata = user?.user_metadata ?? user ?? {};
  // The role chooser is strictly a first-time onboarding step. A missing
  // profile row alone is never evidence that an existing member needs setup.
  if (profileResult.data?.account_type_selected === true) return false;
  return metadata.account_type_pending === true && !metadata.account_type;
}

export function isAuthRefreshError(error) {
  if (!error || error.code === '42501') return false;
  const status = Number(error.status ?? error.statusCode ?? 0);
  if (status === 401) return true;
  const code = String(error.code ?? '').toUpperCase();
  if (code === 'PGRST301' || code === 'PGRST302') return true;
  const message = String(error.message ?? '');
  return /invalid jwt|jwt expired|not authenticated|auth session missing|no jwt/i.test(message);
}
