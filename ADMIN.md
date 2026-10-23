# WrappedStudio — admin panel and backend

The shop is a Vite/React site. The admin panel lives at `/admin` in the
same app but ships as its own bundle, so a customer never downloads it.

| Piece | What it does |
| --- | --- |
| **Supabase Postgres** | products, every editable string, themes, offers, an audit log |
| **Supabase Auth** | email-and-password sign-in for each administrator |
| **Vercel Functions** (`/api`) | the only thing allowed to write; checks the caller first |
| **Upstash Redis** (KV) | caches the storefront payload, cleared on every admin save |
| **Cloudflare** | optional DNS/CDN in front of Vercel (see below) |

## Who can sign in

`roshinip.0931@gmail.com` and `vijayaraghu7010@gmail.com`. Both accounts
exist, are confirmed, and were last verified signing in to the live panel
on 2026-10-23. Each address is checked twice: against
`ADMIN_EMAILS` (env, changeable without a deploy) and against the
`admins` table. A session from any other address is rejected by the API,
so nothing can be changed even if someone signs in. To add or remove an
administrator later, edit `ADMIN_EMAILS` in Vercel and the `admins`
table — both must list the address.

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

   Re-running any of these is safe; every statement is an upsert.

   All five are already applied to the live project
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
   local work, and add the same names in Vercel → *Settings* →
   *Environment Variables*. `SUPABASE_SERVICE_ROLE_KEY` must never be
   given a `VITE_` prefix; that would publish it to the browser.

4. **Cache (optional but wanted here)** — Vercel → *Storage* → add
   **Upstash Redis**. Vercel injects `KV_REST_API_URL` and
   `KV_REST_API_TOKEN` automatically. With no credentials the API still
   works, it just reads Postgres every time.

5. **Deploy**, then open `/admin` and sign in.

## Running it locally

`npm run dev` serves the site but **not** `/api` — Vite has no idea
about serverless functions. For the full stack locally:

```
npx vercel dev
```

which runs the Vite build and the functions together on one port.

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

`.env.supabase.local` holds `SUPABASE_SERVICE_ROLE_KEY`. It is safe there
only because the name has no `VITE_` prefix: Vite copies nothing else
into the browser bundle. Never rename it.

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
- **Clear cache** — forces the storefront to re-read immediately.

Every write is recorded in `admin_audit` with the address that made it.

### Why the panel feels quick

The database is in Tokyo, so a round trip from India is roughly 450 ms
and that is the floor for any single request. Three things keep it off
the screen: the functions run in `hnd1` beside the database rather than
in Virginia (`regions` in `vercel.json`); `currentAdmin()` remembers for
a minute that a token belongs to an administrator, which used to cost
two extra Supabase calls on *every* request; and `adminFetch` keeps GET
answers for fifteen seconds, shares one request between panels that want
the same thing, and throws the lot away the moment anything is written.
All four tabs are fetched in parallel at sign-in, so the first tab
opened is usually already there.

## How the storefront reads it

`GET /api/site-config` returns products, text, the live theme and
running offers in one response, served from Redis when warm (5 min TTL,
cleared on every save). `SiteConfigProvider` applies the theme tokens to
`:root` as CSS variables and hands the products to the data layer. **If
the API is unreachable the site runs on the data it was built with** —
a database outage shows the shop as shipped, not a broken page.

The response is sent `no-store`. It used to carry
`s-maxage=60, stale-while-revalidate=600`, which let Vercel's edge hand
a visitor a payload up to ten minutes old; "Clear cache" could not help,
because that empties Redis and not the CDN.

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

- `SUPABASE_SERVICE_ROLE_KEY` is the only credential that can write.
  It lives in Vercel's environment and in `.env.supabase.local`, never
  in the browser bundle, and must never gain a `VITE_` prefix.
- The tables carry **read** policies only. That is deliberate, not a
  gap: the anon key the browser holds can read the shop and nothing
  else, and every write goes through `/api/admin/*`, which checks the
  bearer token against `ADMIN_EMAILS` and the `admins` table before
  using the service role. Do not add client-side writes expecting RLS
  to allow them — it will not.
- **Leaked-password protection is off.** Supabase can refuse passwords
  found in the HaveIBeenPwned corpus; it is one switch in
  *Authentication* → *Policies* and there is no reason not to turn it
  on. This is the one item the linter still flags.

## Cloudflare

Nothing in the code depends on it. The intended use is DNS + CDN in
front of Vercel: add the domain to Cloudflare, point a CNAME at the
Vercel project, and set SSL to *Full (strict)*. Leave "Rocket Loader"
off — it reorders scripts and can break the React bundle. If you later
want media on Cloudflare R2 or Images, product `image` fields take any
absolute URL, so no code change is needed.

## Still to build

- Applying offer codes at checkout (the offers exist and are served to
  the storefront; the cart does not yet redeem a code)
- Orders and customer accounts in the database
