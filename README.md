# EventBridge Hub — Closed Pilot Application

**Status:** Deployment-ready source code for a **closed pilot**, not a live deployed service. This is the successor to the single-file HTML demo. Built with Next.js 16, Supabase Authentication + Postgres, server actions, and database-enforced Row Level Security (RLS).

## What works when connected to Supabase

| Role | Workflow |
| --- | --- |
| Customer | Signup/login → submit event → track assignment → see **sent** proposal |
| Planner | See events assigned by admin → invite approved vendors → read supplier quotes → create and share itemized proposal |
| Vendor | Apply for directory listing → receive requests targeted only to own business → submit quote/decline |
| Admin | Approve/suspend vendor profiles → assign client events to planner accounts |
| Public | Browse **approved only** vendor listings |

The system records real account and event data in Supabase, **once configured**. RLS guards all data: one vendor cannot read another vendor's quotes; a customer sees only their events and proposals shared with them. Prices are quote-only; there are no reservations, deposits, or payments.

## Setup: roughly 7 steps

**Requirements:** Node.js 20.9+ (22 recommended), npm, a new [Supabase](https://supabase.com) project, and optionally [Vercel](https://vercel.com) for hosting.

1. **Unzip** `EventBridge_Hub_Live_Pilot.zip` and open a terminal in the `eventbridge-live` folder.
2. Create a new Supabase project. From **Project Settings → API / Connect**, copy the Project URL and **publishable key**. **Do not use the `service_role` or secret key in `NEXT_PUBLIC_...` variables.**
3. In Supabase **SQL Editor**, run `supabase/migrations/202610100001_initial.sql`. Use a fresh project; this migration has not been tested against an existing app schema.
4. Make a `.env.local` file by copying `.env.example` and replace the two placeholders. Keep `NEXT_PUBLIC_SITE_URL=http://localhost:3000` for local development. Add `http://localhost:3000/auth/callback` to Supabase **Auth → URL Configuration → Redirect URLs**. In production, change the site URL and add the production callback there too. **Important:** In Supabase **Auth → Email Templates → Confirm signup**, replace the confirmation link with `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm email</a>`, and in **Auth → URL Configuration** set **Site URL** to `http://localhost:3000`. This is required for server-side email confirmation (the default email template returns client-side fragments).
5. In the terminal run:
   ```bash
   npm install
   npm run dev
   ```
   Open `http://localhost:3000`.
6. Create a test **planner** account, **vendor** account, and **customer** account. Confirm their email links as needed. Next create **your operator account** (any of these signup roles), copy its UUID from Supabase **Authentication → Users** and run this SQL in the Supabase SQL Editor (replace the value):
   ```sql
   update public.profiles set role = 'admin' where id = 'YOUR_VERIFIED_USER_UUID';
   ```
   **Never** add admin signup as a public option. Use distinct email addresses when testing each role.
7. As admin, approve the vendor's application and assign the new customer event to the planner; then complete the **end-to-end pilot test** below.

### Publish to Vercel

1. Push the `eventbridge-live` folder to a private Git repository you control.
2. Import it as a Next.js project in Vercel.
3. Set environment variables in Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL=https://YOUR-DOMAIN`). Redeploy after updating them.
4. Add `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/auth/confirm` in Supabase Auth redirect allowlist, and set Supabase **Site URL** to `https://YOUR-DOMAIN`. The template above uses this Site URL.
5. Use your own custom domain and complete privacy and security checks before inviting real users.

No hosting service, Git account, domain, or Supabase project is created by the ZIP file. **You** must connect those services. Keep API secrets out of your repository.

## First end-to-end pilot test

1. Vendor signs up and submits `Party Rentals LLC` as a business → pending.
2. Admin logs in and approves it. Public directory now lists it.
3. Customer signs up and submits a birthday request.
4. Admin assigns the customer event to the planner.
5. Planner opens event, selects `Party Rentals LLC`, and sends quote request.
6. Vendor sees that request and submits an amount, inclusions and expiration date.
7. Planner returns to event, includes the vendor quote and adds a planner fee. Creates a draft and shares it.
8. Customer views the event; the proposal shows each vendor's amount, planner fee and total.
9. Repeat with two vendors to confirm each vendor sees **only its own** request and quotes.
10. Check that no action calls a quote a booking or collects money.

## Key limitations and next additions

This is a functional pilot **codebase**, not a production-validated deployment. It has **not been exercised against a live Supabase project in this environment**. Run `npm run build` and full RLS tests after installation, before onboarding actual users.

- **No transactional email** beyond default Supabase account emails. Planners/vendors must check their dashboards. Next: Resend integration with delivery logs and abuse/rate-limiting controls.
- **No payment handling or firm booking confirmation.** Next: explicit acceptance, contract workflow, conflict/availability checks and Stripe Connect design.
- No file uploads, vendor business editing once approved, quote revisions, inventory sync, customer-planner messaging or PDF proposal exports.
- No automated backup restoration drill, spam defenses, application event audit logs, helpdesk process, business insurance verification, or legal policies. Add these before open public launch.
- Public vendor listings are plain-text cards, with no uploaded photos. Photos require managed storage and moderation.
- Vendor listing can be submitted by each vendor. For an admin-approved listing, changes must be re-reviewed; vendor editing is intentionally omitted.
- Planner sign-up is open for the closed pilot; before public launch, require planner verification/approval.
- Amounts shown are proposals, **not guaranteed final prices**. Confirm terms with the supplier.

See `docs/SECURITY_AND_TEST_PLAN.md` for authorization and launch checks. The original localStorage-only demonstration is bundled in `prototype/eventbridge_hub_mvp.html` for reference, if included.

## Code structure

- `app/`: Public pages, auth, four role dashboards and planner/customer event workspace.
- `lib/actions.ts`: Server-side form actions.
- `lib/supabase/`: Supabase cookie/SSR helpers.
- `supabase/migrations/`: Database tables, constraints, role policies, and atomic proposal creation.
- `proxy.ts`: Next.js 16 proxy for secure Auth session refresh.

## Technical and security notes

- Uses `auth.getClaims()` server-side instead of trusting mutable client session objects.
- Supabase password confirmation and email redirects should be configured in Auth before inviting customers.
- User-provided role metadata allows *only* customer/planner/vendor. Admin is always provisioned manually.
- RLS policies and column grants are applied on all exposed tables; a private schema contains security-definer access helpers.
- Public API has just one writable RPC: atomic creation of planner proposals, which checks access and quote ownership.
- No `service_role` keys are used or required in the web application.

## Release checklist

- [ ] Supabase migration succeeds without SQL errors in a new project.
- [ ] `npm install`, `npm run typecheck`, and `npm run build` pass.
- [ ] Test the nine role-based privacy cases in `docs/SECURITY_AND_TEST_PLAN.md`.
- [ ] Configure Supabase email rate limits and CAPTCHA; review allowed Auth redirects.
- [ ] Configure domain, HTTPS, uptime/error monitoring and environment protection.
- [ ] Add privacy policy, terms, accessibility checks, and support/contact page.
- [ ] Collect informed consent for storing customer event details.
- [ ] Pilot with several trusted local vendors and planners, not unrestricted public signups.
