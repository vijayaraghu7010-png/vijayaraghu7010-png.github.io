# WrappedStudio — security diagnostic

**Date:** 3 November 2026 · **Scope:** wrappedstudio.in, Supabase project `@wrappedstudio`, Cloudflare R2
**Method:** live probing with the site's own public key, RLS and policy review, edge-function source review, header inspection against production.

This was not a paper review. Every claim below was tested against the running system.

---

## The short answer

**The part that matters most is sound.** Customer orders, addresses, phone numbers, payment references, photographs and admin records are not reachable from outside. I probed ten tables anonymously with the key that ships in the site's JavaScript, and every one returned nothing.

Two real problems were found. One is now fixed, one needs a deploy. Neither exposed customer data.

---

## What was tested, and what it did

### Can a stranger read the order book?

The site's publishable key is in the bundle, as it is meant to be. Anyone can take it. So the only question that matters is what it can do. I used it directly against the REST API:

| Table | Holds | Anonymous read |
|---|---|---|
| `orders` | names, addresses, phones, totals | **empty** |
| `order_items` | what was bought | **empty** |
| `order_payments` | UTRs, amounts, proof keys | **empty** |
| `order_tracking_tokens` | the tokens that open an order | **empty** |
| `order_lookup_codes` | the six-digit codes | **empty** |
| `order_photos` | customer photographs | **empty** |
| `admins` | who runs the shop | **empty** |
| `admin_audit` | what staff did | **empty** |
| `customer_bags` | saved baskets | **empty** |
| `upload_sessions` | in-flight uploads | **empty** |

Row-level security is on for all 20 tables. Seven have RLS on and no policies at all — which the automated advisor reports as a notice, but is in fact correct: those are the tables only the server should ever touch, and no policy means no access.

### Can an order be guessed?

Order codes run in sequence — `WS-2026-0031` tells you `WS-2026-0032` exists. That is the obvious attack, and it is closed properly:

- Opening an order needs a code sent to the **email address on the order**.
- Codes are stored as SHA-256 only. So are the tracking tokens. Reading the table gets you nothing.
- Five wrong guesses kill the code. It expires in ten minutes. It is single-use, and a race between two requests is resolved by revoking the loser's token.
- Comparisons use constant-time equality, so the clock cannot leak how far a guess matched.
- Rate limits are counted **inside Postgres** in one statement, so parallel requests cannot all read the same number and write it back. Limits apply per caller *and* per order; the per-order one cannot be forged, because whoever is asking is asking about that order.

I tested the failure replies. A non-existent order, a wrong email, a wrong code and an already-spent code all return the **same sentence and the same status**. There is no way to tell them apart, which is what stops the order book being read one guess at a time.

Asking for a code three times in a row produced **one** code, not three — so the shop cannot be used to spam somebody's inbox.

### What does a tracking token actually get you?

Only a status. The reply is built field by field, so a column added to `orders` later cannot leak by simply existing. The token cannot download a photograph, cannot change anything, and cannot reach another order. It lasts an hour and is taken out of the address bar as soon as it is used.

### Payments

A customer saying they paid is treated as a claim, never as evidence. Nothing a customer submits moves an order to paid — only a person at the studio confirming they saw the money. The database enforces this too: reference numbers must be alphanumeric, proof files must live under `payments/`, and content type and size are constrained at the column.

### Admin access

Admin is a Supabase login **plus** an allowlist in the `admins` table, checked on the server on every single request. A header claiming to be an administrator means nothing. All 17 edge functions require a valid JWT.

The automated advisor flags `is_admin()` as a `SECURITY DEFINER` function callable by anyone. **That one is a false positive** — it reads the caller's own token and returns a boolean about them. I called it anonymously: it returns `false`.

### Secrets

`.env` is not tracked by git, and no API key appears in any tracked file.

---

## Problems found

### 1. Anyone could write reviews, without limit — FIXED, needs deploy

**This was the real hole.** The `reviews` table allowed `INSERT` from the anonymous role with no condition at all. Since the key is public, that meant anybody could file unlimited reviews, at any star rating, against any product, with a single command. Every check — one to five stars, a line of text, a name — lived in React, which means it was advice, not a rule.

I confirmed it by writing a review with a raw HTTP call, then deleted it.

Update and delete were correctly blocked, so existing reviews could not be altered — only flooded with new ones. The practical risk was rating manipulation and spam, not data loss.

**Fixed by:** a new `reviews-create` edge function that applies the checks where they cannot be skipped, confirms the product exists, rate limits per caller and per product, and writes with the service role; plus migration `0010` dropping the open policy. Reading reviews stays public.

> **Deploy order matters.** The function must be live *before* the site that calls it, and the migration must be applied *last*. See the commands at the end.

**What this does not claim:** it does not prove a human wrote it, or that they bought the thing. Without accounts, the caller's address is the only handle, and it can be changed. The per-product limit is the one that actually holds. If you want this settled properly, the two real options are **tie reviews to a real order**, or **hold new reviews for your approval** — both are decisions about how you want the shop to work, so I have not made them for you.

### 2. No security headers — FIXED

Production sent only `Strict-Transport-Security`. Missing: `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

The one with teeth is framing: **the admin panel and the payment page could be loaded inside an iframe on any site**, which is how clickjacking works — an attacker overlays invisible buttons and your own clicks do their work.

**Fixed by:** all five added in `vercel.json`, plus `includeSubDomains; preload` on HSTS.

The CSP was tested against the production build before shipping — home, polaroids, track, hampers, the 3D hamper studio and the admin panel all load with **zero violations**, fonts load, and Supabase calls succeed. A CSP that breaks the shop would be worse than none.

---

## Still open

### 3. The Resend API key needs rotating — ACTION NEEDED

The key was shown in a terminal screenshot earlier and is in terminal scrollback and probably PowerShell history. It is sending-only and locked to your domain, so the worst case is bounded — somebody could send email as your domain. That is still worth closing.

**Do:** Resend → API Keys → revoke the old one, create a new one, then set `RESEND_API_KEY` again with `npx supabase secrets set`.

### 4. Leaked-password protection is off

Supabase can refuse passwords known from public breaches. It is one toggle: Authentication → Policies → enable leaked password protection. Worth it — the admin login is the key to every order in the shop.

### 5. `TRUSTED_IP_HEADER` is not set

The code is honest about this: it marks IP-based limits untrustworthy and logs a warning, because `X-Forwarded-For` can be written by the client. The limits that matter — per order, per code, per product — do not depend on it. Setting it would make the per-caller limits real too.

### 6. The UPI ID is world-readable

`settings` is publicly readable, which exposes the studio's UPI ID and display name to anyone, without needing an order. It is on the payment page anyway, but only to someone holding a tracking token — so RLS exposes it more widely than the shop does. **Low severity**; the risk is somebody harvesting it for a "pay this UPI instead" scam. Narrow the policy to the payment function if you want it closed.

### 7. No robots.txt, no admin MFA

`robots.txt` returns 404. Neither is a vulnerability; both are cheap hardening.

---

## One data oddity, not a security issue

`WS-2026-0032` has `status = 'paid'` but `payment_status = 'unpaid'`. This is what happens when an order is marked paid by hand in the Orders panel rather than through the UPI flow — `order-status` sets the order's status, while only `payments-admin` sets `payment_status`. The two columns mean different things and the code reads both, so nothing is broken. Worth knowing when reading the table: `payment_status` is not a reliable "has this been paid".

---

## Deploy order

```
# 1. the function first — nothing calls it yet, so this breaks nothing
npx supabase functions deploy reviews-create

# 2. then the site, which starts calling it
npx vercel deploy --prod --yes

# 3. and only then close the open policy
npx supabase db push        # applies 0010_reviews_server_side_only.sql
```

Applying step 3 early would break review posting on the live site until step 2 lands.
