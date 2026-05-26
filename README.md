# Cursor Hyderabad Meetup — Credit Claim Portal

Production-ready, self-service portal for distributing **Cursor credits** to approved attendees of the **Cursor Hyderabad Meetup** (hosted by Syed Fahad).

Attendees enter their email → backend validates they're on the approved list → an unused Cursor credit URL is atomically assigned to them → a beautifully branded email is sent via Resend with their unique link. No raw credit URLs are ever exposed in the browser.

> Built as a Supabase + Resend rewrite of the original [cursorcommunityled/cursor-credits-portal](https://github.com/cursorcommunityled/cursor-credits-portal), trimmed down to one simple flow: **email in → credit link mailed**.

---

## ✨ Features

**Attendee flow**
- Single-field email claim form, mobile-first dark UI with the Hyderabad-skyline gradient.
- Live counters: `N credits available`, `X of Y attendees have claimed`.
- Atomic claim: `FOR UPDATE SKIP LOCKED` guarantees no two attendees ever get the same credit, even under thundering-herd traffic.
- Friendly states for `success` / `already-claimed` / `not-on-list` / `no-credits` / `rate-limited`.
- Beautifully styled HTML email via Resend.

**Admin dashboard** (`/admin`, password-gated)
- Stats: total attendees, claimed, remaining credits, total credit pool.
- 24h analytics: attempts, success rate, not-found rate.
- Recent successful claims + latest attempts feed.
- **Attendees**: search by email, filter (all / claimed / unclaimed), **resend** credit email, **revoke** assigned credit.
- **Credits**: full view of the credit pool (used / available).
- **Import**: drag-and-drop CSV upload for attendees and credit URLs.
- **Export**: one-click CSV of all claims with assigned URLs.

**Security**
- All credit-assignment logic runs server-side (Next.js route handlers + Postgres function).
- Supabase Row-Level Security is enabled on every table; only the **service role** key (server-only) bypasses it. The browser never sees the service role.
- Admin auth uses a strong-password HMAC-signed cookie with timing-safe comparison.
- Per-IP sliding-window rate limit on the public claim endpoint (defaults: 5 attempts / 60s).
- Security headers via `vercel.json` (XFO, nosniff, referrer-policy, permissions-policy).
- All admin and claim API routes return `Cache-Control: no-store`.
- Email send failures roll back the claim so credits are never lost.

---

## 🛠 Tech stack

| Layer    | Choice                            |
| -------- | --------------------------------- |
| Frontend | Next.js 15 (App Router), React 19 |
| Styling  | Tailwind CSS 3                    |
| Backend  | Next.js Route Handlers + Supabase |
| Database | Supabase Postgres                 |
| Email    | Resend                            |
| Hosting  | Vercel                            |

---

## 🚀 Setup (start to finish, ~15 minutes)

### 1. Clone & install

```bash
cd cursor-hyderabad-credits
npm install
```

### 2. Provision Supabase

1. Create a project at <https://supabase.com>.
2. In the SQL editor, paste and run **`supabase/schema.sql`**. This creates:
   - `attendees`, `credit_links`, `claim_attempts` tables
   - `dashboard_stats` view
   - `claim_attendee_credit(email)` atomic claim function
   - `revoke_credit(attendee_id)` function
   - Row-Level Security enabled (anon has zero access; the service role key bypasses it)
3. Go to **Project Settings → API** and copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` **(server-only, keep secret)**

### 3. Provision Resend

1. Create an account at <https://resend.com>.
2. Add and verify your sending domain (e.g. `credits@yourdomain.dev`).
3. Generate an API key → `RESEND_API_KEY`.
4. Set `RESEND_FROM_EMAIL` to something like `Cursor Hyderabad <credits@yourdomain.dev>`.

### 4. Environment variables

```bash
cp .env.example .env.local
# fill in real values
```

Required keys (see `.env.example` for the full list):

| Var | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (server-only) |
| `RESEND_API_KEY` | Resend dashboard |
| `RESEND_FROM_EMAIL` | A verified Resend sender |
| `ADMIN_PASSWORD` | Anything strong — used to log into `/admin` |
| `ADMIN_SESSION_SECRET` | Any 32+ char random string |

### 5. Run locally

```bash
npm run dev
```

Open <http://localhost:3000>.

### 6. Load your data

1. Visit <http://localhost:3000/admin/login> and sign in with your `ADMIN_PASSWORD`.
2. Go to **Import** and upload:
   - **Attendees CSV** — must have an `email` column (`name` optional). The Luma export works out of the box; the parser also accepts `first_name` + `last_name`.
   - **Credits CSV** — must have a `cursor_url` column (also accepts `url`, `link`, `credit_url`, `code`).
3. Confirm the counts on the **Dashboard**.

> Sample CSVs are bundled at `public/samples/attendees.sample.csv` and `public/samples/credits.sample.csv`, and at `supabase/seed.sample.csv` / `supabase/credits.sample.csv`.

### 7. Test the flow

1. Open <http://localhost:3000>.
2. Enter an email that's in your imported attendee list.
3. Check the inbox — the credit email should arrive within seconds.
4. Try the same email again → you'll see the **already claimed** state.
5. Try an email that isn't on the list → **not-on-list** state.

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project at <https://vercel.com/new>.
3. **Framework preset**: Next.js (auto-detected).
4. Add every variable from your `.env.local` to **Project Settings → Environment Variables** (Production + Preview).
5. Deploy.

The `vercel.json` pins the region to `bom1` (Mumbai) which is closest to Hyderabad — change it if you prefer.

### Custom domain

1. **Vercel → Project → Domains** → add `credits.yourdomain.dev` (or whatever).
2. Also verify that same root domain on **Resend**, otherwise emails will be marked as spam.

---

## 📐 Architecture

```
src/
├── app/
│   ├── page.tsx                 # Landing + claim form (single page UX)
│   ├── success/                 # Standalone success page
│   ├── already-claimed/         # Standalone duplicate page
│   ├── invalid/                 # Standalone not-on-list page
│   ├── admin/
│   │   ├── layout.tsx           # Admin chrome (header/nav)
│   │   ├── page.tsx             # Dashboard (stats, analytics, recent claims)
│   │   ├── login/               # Password login
│   │   ├── attendees/           # Search / resend / revoke
│   │   ├── credits/             # Credit pool view
│   │   └── import/              # CSV uploaders
│   └── api/
│       ├── claim/               # POST: public claim endpoint
│       └── admin/
│           ├── login/, logout/  # Cookie-based session
│           ├── attendees/[id]/{resend,revoke}/
│           ├── import/{attendees,credits}/
│           └── export/          # GET CSV of all claims
├── components/                  # BrandMark, ClaimForm, Footer
└── lib/
    ├── env.ts                   # Zod-validated env loader
    ├── supabase.ts              # Server-only admin client
    ├── adminAuth.ts             # HMAC-signed cookie auth
    ├── rateLimit.ts             # In-memory sliding window
    ├── email.ts                 # Resend client + HTML template
    └── csv.ts                   # Robust CSV parsing & generation
supabase/
└── schema.sql                   # Tables, RLS, RPC functions, view
```

### Claim flow (server-side)

```
POST /api/claim {email}
  → rate-limit check (per IP)
  → supabase.rpc('claim_attendee_credit', { email })
       BEGIN
         SELECT attendee FOR UPDATE
         if not found        → return 'not_found'
         if claimed          → return 'already_claimed' (+ original URL)
         SELECT next credit FOR UPDATE SKIP LOCKED
         if no rows          → return 'no_credits'
         UPDATE credit       (used=true, assigned_to, assigned_at)
         UPDATE attendee     (claimed=true, claimed_at, credit_id)
       COMMIT
  → send Resend email
  → if email fails           → revoke_credit (rollback)
  → log to claim_attempts
  → return outcome to client
```

The DB is the source of truth and concurrency-safe — even if 1000 attendees hit "claim" at the same moment, each will get a distinct credit and none will be double-issued.

---

## 📧 Email copy

**Subject**: `Your Cursor Credits for Cursor Hyderabad Meetup`

**Body** (rendered as a dark-themed HTML email):

> Hi {firstName},
>
> Thanks for attending **Cursor Hyderabad Meetup**.
>
> [Claim my Cursor credits] → `{credit_link}`
>
> Important
> - Redeem while logged into the correct Cursor account.
> - Credits work for *individual* accounts, not Team plans.
>
> Presented by **Cursor Hyderabad, India**
> Hosted by Syed Fahad

A plain-text fallback is sent automatically.

---

## ✅ Pre-event checklist

- [ ] Supabase project provisioned + `schema.sql` run.
- [ ] Resend domain verified.
- [ ] All env vars set in Vercel (Production).
- [ ] Custom domain pointed at Vercel + verified in Resend.
- [ ] Attendees CSV imported (verify count on Dashboard).
- [ ] Credit URLs CSV imported (verify count on Dashboard).
- [ ] Test claim with your own email — confirm email arrives.
- [ ] Test second claim with same email — confirms duplicate-protection.
- [ ] `ADMIN_PASSWORD` rotated and shared securely with co-organizers.
- [ ] Send the Luma blast email with the claim portal URL.

---

## 🧯 Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Invalid or missing environment variables` on boot | Open `.env.local` and ensure every var listed in `.env.example` is filled in. |
| Email never arrives | Check Resend dashboard → Logs. Verify your domain is fully verified (SPF/DKIM green). |
| `Server error. Please try again.` on claim | `npm run dev` console will show the Supabase error. Usually a missing `schema.sql` step or wrong service-role key. |
| Admin login fails | Confirm `ADMIN_PASSWORD` matches exactly (no trailing whitespace), and `ADMIN_SESSION_SECRET` is set. |
| Rate-limited yourself testing | Bump `RATE_LIMIT_MAX` in `.env.local`, restart `npm run dev`. |

---

## 📄 License

MIT — fork it, ship it, run your meetup.

---

Built with ❤️ for **Cursor Hyderabad, India** by Syed Fahad.
