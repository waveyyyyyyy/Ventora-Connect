# Ventora Connect

**Where Ambition Meets Opportunity.**

Ventora Connect is a business–investor discovery and networking application. It is not an investment adviser, broker, exchange, crowdfunding intermediary, or payment processor. Expressions of interest and profile information are not investment commitments.

## Stack

- React 19 + TypeScript + Vite
- Supabase Auth, Postgres, Row Level Security, Storage and Realtime
- Vercel production hosting
- Framer Motion and Lucide icons

## Current application areas

- Public landing page and business/investor discovery
- Email/password and Google OAuth flows, password reset
- Role-aware member workspace and profile editing
- Business profile publishing and private pitch-deck upload
- Investor preferences
- Connection requests and notifications
- Private messaging after an accepted connection
- Investment-interest workflow
- Private identity-document submission and admin review
- Admin command centre, moderation and support requests
- Member support history

## Supabase first-time setup

1. Open the **Ventora Connect** Supabase project (project ref: `nlkcnewcrcgylubqulph`).
2. Open **SQL Editor**.
3. Open `supabase/SETUP_ALL.sql` in this repository, copy the full contents, and run it once.
4. In **Authentication → URL Configuration**, set the production Site URL to the Vercel production domain and add the matching redirect URLs for production and local development.
5. In **Authentication → Providers**, enable Google and configure your own Google OAuth client ID and secret. Add the Supabase callback URL shown in the Google provider settings to the Google Cloud OAuth client.
6. Keep email verification enabled. Test signup, verification, login, Google login, reset-password and logout before inviting members.

The Vercel project already has the two public frontend environment variables configured:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The publishable/anon key is expected in browser code. Never put a Supabase service-role key, database password, OAuth client secret, or private API key in frontend code or a `VITE_*` variable.

## Bootstrap the first administrator

After creating and verifying the intended administrator account, run the following in the Supabase SQL Editor, replacing the email with the exact account email:

```sql
insert into public.admin_roles(user_id, role)
select id, 'admin'
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL')
on conflict (user_id) do update set role = excluded.role;
```

Do not make the admin role self-service. Only a trusted project owner should execute this step.

## Local development

```bash
npm install
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Production build and strict TypeScript check:

```bash
npm run build
```

## Launch checklist

- [ ] Run `supabase/SETUP_ALL.sql` on the correct Ventora Supabase project.
- [ ] Configure Supabase Site URL, redirect URLs, Google OAuth and email templates.
- [ ] Bootstrap the first administrator using the SQL above.
- [ ] Test RLS with separate business, investor and admin accounts.
- [ ] Test storage policies using two different member accounts.
- [ ] Test real-time messages and notification delivery.
- [ ] Add a custom domain and verify it in Vercel.
- [ ] Publish reviewed Privacy Policy, Terms, Cookie Policy, Community Guidelines and Risk Disclosure.
- [ ] Obtain qualified Indian legal and regulatory advice before enabling any investment solicitation, securities activity, paid placement, payment collection, or investor accreditation claims.

## Important production limitations

A successful Vercel deployment does not mean the database is configured or the product has passed a security audit. Apply the SQL setup, configure OAuth and verify the actual RLS and storage boundaries before public launch. Legal pages and regulatory positioning require review by qualified counsel. No investment transaction, payment, escrow, equity transfer, or binding agreement workflow is implemented.
