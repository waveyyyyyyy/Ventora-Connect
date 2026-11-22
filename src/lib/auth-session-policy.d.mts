export function retainCachedSessionOnUnexpectedSignOut(
  manualSignOutPending: boolean,
  cachedSession: { access_token?: string; user?: { id?: string } } | null
): boolean;

export function shouldOfferRoleSelection(profileResult: {
  data?: { account_type_selected?: boolean } | null;
  error?: unknown;
} | null): boolean;

export function isAuthRefreshError(error: {
  code?: string;
  status?: number;
  statusCode?: number;
  message?: string;
} | null): boolean;
