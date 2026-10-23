# WrappedStudio — admin panel and backend

The shop is a Vite/React site. The admin panel lives at `/admin` in the
same app but ships as its own bundle, so a customer never downloads it.

| Piece | What it does |
| --- | --- |
| **Supabase Postgres** | products, every editable string, themes, offers, an audit log |
| **Supabase Auth** | email-and-password sign-in for each administrator |
| **Row-level security** | decides every read and write, from the caller's own token |
| **GitHub Pages** | serves the built site; a push to `main` deploys it |

There is no backend of our own. The site is static files and the
database is reached directly from the browser, so the rules that used
to live in serverless functions live in RLS policies instead.

## Who can sign in

`roshinip.0931@gmail.com` and `vijayaraghu7010@gmail.com`. Both accounts
exist, are confirmed, and were last verified signing in to the live panel
on 2026-10-23. The `admins` table is the authority: `is_admin()` reads
it for the email in the caller's token, and every write policy asks that
function first. A session from any other address can read the shop and
change nothing — Postgres refuses the write itself. To add or remove an
administrator, insert or delete the row in `admins`; it takes effect on
their next request, with no deploy.

Either administrator can change their own password from **Password** in
the admin bar; it asks for the current one first. That button is hidden
in local SQLite mode, where the password comes from the environment and
is shared.

## Setting it up

1. **Create a Supabase project** (free tier is fine), then in
   *SQL Editor* run, in order:
   - `supabase/migrations/0001_init.sql` — tables, RLS, the admin row
   - `supabase/migrations/0002_seed.sql` — today's 12 products, 40 text
     keys, the current palette as the default theme, and four festival
     themes (Diwali, Christmas, Valentine, Pongal)
   - `supabase/migrations/0003_fix_admin_recursion.sql` — makes
     `is_admin()` security definer. Without it the admins policy calls
     a function that reads admins, which runs the policy again, and
     every query to the table fails with *stack depth limit exceeded*.
     Sign-in is impossible until this one has run.
   - `supabase/migrations/0004_harden_functions.sql` — pins
     `touch_updated_at` to an empty `search_path` and takes `EXECUTE` on
     `is_admin()` away from `anon`, so the function is not reachable at
     `/rest/v1/rpc/is_admin` without a session. Clears two warnings from
     the Supabase security linter.
   - `supabase/migrations/0005_realtime.sql` — adds the four tables the
     storefront reads to the realtime publication, so a save pushes to
     every open page instead of waiting to be asked again.
   - `supabase/migrations/0006_browser_writes.sql` — the policies that
     let the panel write from the browser, now that no server holds the
     service key, and the `media` bucket they upload into. It also
     splits the products and offers read policies in two: the signed-out
     one no longer calls `is_admin()`, which `anon` is not allowed to
     execute. **Until this has run the storefront cannot read products
     at all** — it answers *permission denied for function is_admin* and
     the shop quietly falls back to its built-in catalogue.

   Re-running any of these is safe; every statement is an upsert.

   The first five are already applied to the live project
   (`rhzqveijuclwegztogsr`). The list is here for rebuilding from scratch.

2. **Auth settings** in Supabase → *Authentication* → *URL
   Configuration*: set the Site URL to your domain and add
   `https://<your-domain>/admin` as a redirect URL.

   Both users already exist on the live project, so this is only for a
   fresh one. In *Authentication* → *Users*, add one user per address in
   `ADMIN_EMAILS` with **Add user → Create new user**, give it a
   password and tick *Auto Confirm User* — an unconfirmed address has a
   working password but is still refused at sign-in, which looks exactly
   like a wrong password. If you would rather not click through the
   dashboard, run `supabase/CREATE_ADMIN_USERS.sql` in the SQL Editor
   instead — put your passwords in it first; it creates both logins,
   confirmed, and adds the matching `admins` rows.

   Mailed sign-in links were dropped: the project's built-in mail
   allowance is a few messages an hour, and running it dry locks the
   owner out. Passwords live nowhere in this repository; after the first
   sign-in, change them from **Password** in the admin bar.

3. **Environment variables** — copy `.env.example` to `.env.local` for
   local work. For the deployed site the two `VITE_` values are
   repository secrets instead (*Settings* → *Secrets and variables* →
   *Actions*): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The
   workflow passes them to `npm run build`, which bakes them into the
   bundle — which is the point: the browser is the only client now.

4. **Deploy** — push to `main`. `.github/workflows/pages.yml` builds the
   site and publishes it to Pages; *Settings* → *Pages* → *Source* must
   be **GitHub Actions**. Then open `/admin` and sign in.

## Running it locally

`npm run dev` serves the site, and against the hosted database that is
the whole stack — there is nothing else to run. Only SQLite mode needs
the Express backend as well, which `npm run dev:all` starts alongside
Vite.

### Two local backends

Which one you get is decided by whether `.env.local` holds
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `src/lib/supabaseClient.js`
checks for them and falls back when they are absent — there is no flag
to set.

- **SQLite** (the default as shipped): `.env.local` carries only
  `ADMIN_EMAILS` and `LOCAL_ADMIN_PASSWORD`, and the panel talks to the
  small Express backend in `server/`. Sign-in is the shared
  `LOCAL_ADMIN_PASSWORD`, the same for either address.
- **Supabase**: copy `.env.supabase.local` over `.env.local` and restart.
  The panel then signs in with each administrator's own password
  against the hosted project, and every write lands in the real
  database — including the one the live site reads, so take care.

`.env.supabase.local` still holds `SUPABASE_SERVICE_ROLE_KEY`. Nothing in
the app reads it any more — it is kept for one-off maintenance from a
terminal. It is safe there only because the name has no `VITE_` prefix:
Vite copies nothing else into the browser bundle. Never rename it, and
never put it in a repository secret, which the build would publish.

## What the admin can do

- **Products** — create, edit, delete; set price and price mode
  (fixed or per-unit), images, descriptions, details, occasions, search
  keywords; mark featured; keep a product as an unpublished draft.
  Pictures upload straight from the panel into the `media` bucket
  (public, 8 MB, images only); an absolute URL still works if you would
  rather host elsewhere.
- **Text** — every string that has been given a key: hero, page titles
  and subtitles, category cards, benefits, brand and contact lines.
  New keys can be added for copy wired up later. A key that has no row
  falls back to what is written in the code, so the site never breaks.
- **Theme** — edit any palette token with a colour picker, make a theme
  live, or schedule one. **A festival theme with a start and end date
  turns itself on and off** — set Diwali to its week and the whole shop
  changes on the day and reverts after.
- **Offers** — percent or flat discounts, with or without a code, scoped
  to everything / a category / one product, with minimum order, maximum
  discount and a date window.
- **Clear cache** — drops the panel's own fifteen-second cache and
  re-reads. There is no shared cache left to empty: every reader goes
  to the database, so a save is visible as soon as it lands.

Every write is recorded in `admin_audit` with the address that made it.

### Why the panel feels quick

The database is in Tokyo, so a round trip from India is roughly 450 ms
and that is the floor for any single request. Going direct actually
helps here: a click used to travel to a serverless function and on to
Tokyo, and now it makes that trip once. `adminFetch` keeps GET answers
for fifteen seconds, shares one request between panels that want the
same thing, and throws the lot away the moment anything is written. All
four tabs are fetched in parallel at sign-in, so the first tab opened is
usually already there.

## How the storefront reads it

`src/lib/siteConfig.js` reads products, text, themes and running offers
with the anon key — four queries sent together, which is what
`/api/site-config` did behind its cache. `SiteConfigProvider` applies the
theme tokens to `:root` as CSS variables and hands the products to the
data layer. **If the database is unreachable the site runs on the data
it was built with** — an outage shows the shop as shipped, not a broken
page.

Nothing is cached in between any more, so there is no stale copy to
explain away: what the admin saved is what the next read returns.

### Staying current without a reload

`src/lib/liveUpdates.js` subscribes to Postgres changes on the four
tables and tells every listener to re-read. An edit on a laptop reaches
a phone that is sitting open on the shop in about a second, with no
refresh. supabase-js is loaded there by dynamic import so the first
paint does not wait for a websocket library.

Three things back it up, because a websocket on a sleeping phone is not
a promise: the page re-reads when it regains focus, again every minute,
and the admin panel drops its own cache on the same signal. A scheduled
festival theme needs the interval — it turns itself on at an hour when
nobody is editing.

## Security notes

- The browser holds the anon key and nothing else. It is public by
  design; it identifies the project, it does not grant anything.
  `SUPABASE_SERVICE_ROLE_KEY` is no longer used by the app at all, and
  must never gain a `VITE_` prefix or become a repository secret.
- **The policies are the whole of the security model now.** A write is
  allowed only for a signed-in user whose email has a row in `admins`
  (`is_admin()`), checked by Postgres on every statement — so a tampered
  bundle, curl, or anyone else's session gets the same refusal. Anything
  added to the panel is governed by the same policies; a new table needs
  its own, or it is either unreachable or wide open.
- Signed-out readers are limited to published products and active
  offers. Drafts and expired offers need a session, which is why the
  read policies are split by role in 0006.
- **Leaked-password protection is off.** Supabase can refuse passwords
  found in the HaveIBeenPwned corpus; it is one switch in
  *Authentication* → *Policies* and there is no reason not to turn it
  on. This is the one item the linter still flags.

## A custom domain

Pages serves the site at `https://vijayaraghu7010-png.github.io/`. For
a domain of your own, add it under *Settings* → *Pages* → *Custom
domain* — that writes a `CNAME` file into the published site — and point
the DNS at GitHub. Then add the domain as the Site URL and as an
`/admin` redirect URL in Supabase → *Authentication*, or sign-in will
bounce back to the old address. Product `image` fields take any absolute
URL, so media can live anywhere.

## Still to build

- Applying offer codes at checkout (the offers exist and are served to
  the storefront; the cart does not yet redeem a code)
- Orders and customer accounts in the database
