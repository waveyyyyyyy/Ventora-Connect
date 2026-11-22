import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isAuthRefreshError,
  retainCachedSessionOnUnexpectedSignOut,
  shouldOfferRoleSelection,
} from '../src/lib/auth-session-policy.mjs';

const read = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('a failed profile query never opens the first-time role chooser', () => {
  assert.equal(shouldOfferRoleSelection({ data: null, error: { message: 'Auth session missing' } }), false);
  assert.equal(shouldOfferRoleSelection({ data: null, error: { message: 'Network error' } }), false);
  assert.equal(shouldOfferRoleSelection({ data: null, error: null }), true);
  assert.equal(shouldOfferRoleSelection({ data: { account_type_selected: true }, error: null }), false);
});

test('database permission denied is not treated as an expired login', () => {
  assert.equal(isAuthRefreshError({ code: '42501', status: 403, message: 'permission denied by row-level security policy' }), false);
  assert.equal(isAuthRefreshError({ code: 'PGRST301', status: 401, message: 'JWT expired' }), true);
  assert.equal(isAuthRefreshError({ status: 401, message: 'Unauthorized' }), true);
  assert.equal(isAuthRefreshError({ message: 'Auth session missing!' }), true);
});

test('only an explicit sign-out clears the in-memory member identity', () => {
  const session = { access_token: 'token', user: { id: 'member-1' } };
  assert.equal(retainCachedSessionOnUnexpectedSignOut(false, session), true);
  assert.equal(retainCachedSessionOnUnexpectedSignOut(true, session), false);
  assert.equal(retainCachedSessionOnUnexpectedSignOut(false, null), false);
});

test('the app wires the regression policies into the real auth paths', async () => {
  const [auth, workspace, messages] = await Promise.all([
    read('../src/lib/supabase.ts'),
    read('../src/Workspace.tsx'),
    read('../src/Messages.tsx'),
  ]);
  assert.match(auth, /retainCachedSessionOnUnexpectedSignOut/);
  assert.match(auth, /verifiedSessionInFlight/);
  assert.match(auth, /requireActiveSession/);
  assert.doesNotMatch(auth, /auth\.refreshSession\s*\(/);
  assert.match(workspace, /if\s*\(p\.error\)/);
  assert.match(workspace, /shouldOfferRoleSelection\(p\)/);
  assert.match(workspace, /requireActiveSession\(user\.id\)/);
  assert.doesNotMatch(workspace, /auth\.refreshSession\s*\(/);
  assert.match(messages, /isAuthRefreshError\(error\)/);
  assert.doesNotMatch(messages, /error\.code\s*===\s*['"]42501['"]/);
});
