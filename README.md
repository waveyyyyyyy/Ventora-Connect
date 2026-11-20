# Ventora Connect

Premium business and investor discovery platform.

## Stack
React, TypeScript, Vite, React Router, Framer Motion, Supabase.

## Local development
1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the existing Ventora Supabase project credentials.
3. Run `npm install` and `npm run dev`.

## Database
Review and apply `supabase/migrations/202611210001_initial_schema.sql` in the existing Supabase project's SQL Editor. Storage bucket policies, admin-only backend operations, and additional role-based access tests remain required before production use.

## Deployment
Connect this repository to the dedicated Ventora Connect Vercel project and set the two environment variables above. Never place a service-role key in a Vite environment variable.

## Product safety
Ventora is a networking and discovery platform. An expression of interest is not a binding investment commitment. No funds, securities or equity transfers are processed by this application.
