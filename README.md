# Lale

Pickup-first mobile ordering, table reservations, and loyalty for a modern Anatolian neighborhood restaurant — built to replace commission-heavy aggregators, tame Friday–Saturday rush chaos, and cut weekend no-shows by owning the guest reorder channel on their phone.

**Product spec:** [EMERGENT_MASTER_PROMPT.md](./EMERGENT_MASTER_PROMPT.md)  
**Project history:** [PROGRESS_LOG.md](./PROGRESS_LOG.md) (append-only log of phases, audits, and QA evidence)

## Tech stack

| Layer | Technology |
|-------|------------|
| App | Expo SDK 57 / React Native / TypeScript |
| Backend | Supabase (Postgres, Auth, RLS, Realtime, Edge Functions) |
| Payments | Stripe PaymentSheet + deposit holds (peak reservations) |
| Client state | React Query (server) + Zustand (cart/checkout UI) |
| CI | GitHub Actions — typecheck + QA harnesses |

## Prerequisites

- Node.js 20+
- npm 10+
- [Expo Go](https://expo.dev/go) or iOS/Android simulator (for native Stripe flows)
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations

## Quick start (local fallback — no backend)

Works immediately without any credentials:

```bash
git clone <repo-url>
cd restaurant
npm install
npx expo start
```

When **no** `.env` is present, `isLocalFallbackMode()` is `true`:

- OTP screen shows **Guest / Staff / Owner** local dev sign-in buttons
- Orders, reservations, kitchen, and settings use the in-memory domain simulator
- Stripe PaymentSheet is skipped; checkout uses simulated payment

## Full setup (Supabase + Stripe)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

**Never commit `.env`.** Copy the template and fill in real values:

```bash
cp .env.example .env
```

| Variable | Where to get it | Client / server |
|----------|-----------------|-----------------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | Client (safe in app) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` `public` key | Client (safe; RLS enforced) |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → Publishable key (`pk_test_…`) | Client |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` key | **Server only** — Edge Functions / seed script |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Secret key (`sk_test_…`) | **Server only** — Edge Functions |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → signing secret | **Server only** |
| `TWILIO_*` | Twilio console (optional SMS fallback) | **Server only** |

Optional QA tokens (scripts only, never ship in the mobile app):

- `SUPABASE_TEST_ACCESS_TOKEN` — guest JWT for live RPC tamper tests
- `SUPABASE_TEST_STAFF_TOKEN` / `SUPABASE_TEST_OWNER_TOKEN` — role-specific integration tests

### 3. Database migrations

Apply in order against your Supabase project:

```bash
# Link project (first time)
npx supabase link --project-ref <your-project-ref>

# Push migrations (includes 002_fix_order_price_trust.sql)
npx supabase db push
```

Or run the SQL files manually in the Supabase SQL editor:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_fix_order_price_trust.sql`

### 4. Seed menu data

```bash
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
npx tsx scripts/seed-supabase.ts
```

Verify: `select count(*) from menu_items;` should return seeded rows.

### 5. Deploy Edge Functions

Deploy functions under `supabase/functions/` and set secrets in Supabase (`STRIPE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, etc.).

### 6. Run the app

```bash
npx expo start
```

With valid `EXPO_PUBLIC_SUPABASE_*` in `.env`, `isLocalFallbackMode()` becomes **`false`**:

- Real Supabase phone auth (requires SMS provider configured in Supabase Auth)
- Orders persist via `create_order` RPC + Stripe PaymentSheet
- Realtime sync on kitchen/reservation/menu channels

Web dev (non-payment screens):

```bash
npx expo start --web
```

Stripe PaymentSheet requires iOS/Android native builds.

## Demo accounts (local fallback & seeded DB)

| Role | Phone | Notes |
|------|-------|-------|
| Guest | any 10-digit | Local dev sign-in when Supabase unset |
| Staff | `5550001111` | Kitchen / host boards |
| Owner | `5550002222` | Settings, menu manager, analytics |

## Tests

```bash
npm run typecheck          # tsc --noEmit
npm run test:qa            # Domain utils + full simulator flow (no backend)
npm run test:e2e           # E2E regression + web bundle export (no backend)
npm run test:integration   # Requires EXPO_PUBLIC_SUPABASE_* in env
npm run test:credential-backed  # Full Part B pass; requires .env + JWT tokens
```

## Key scripts

| Script | Purpose |
|--------|---------|
| `scripts/qa-harness.ts` | Pure utility + price-trust mirror tests |
| `scripts/store-flow-qa.ts` | Guest → kitchen → loyalty simulator |
| `scripts/e2e-qa-pass.ts` | Full regression with evidence log |
| `scripts/supabase-integration-qa.ts` | Live smoke + RPC tamper (guest JWT) |
| `scripts/credential-backed-qa.ts` | Credential-backed final verification |
| `scripts/seed-supabase.ts` | Menu seed via service role |

## Security notes

- **`.env` must never be committed** — it is listed in `.gitignore`.
- Never put `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in the mobile app or `EXPO_PUBLIC_*` vars.
- Order prices are computed server-side in `create_order` RPC (migration 002); client-supplied prices are ignored.
- See `PROGRESS_LOG.md` → *Security & Correctness Audit Fix* for the full audit trail.

## License

See [LICENSE](./LICENSE). (MIT — confirm ownership/copyright with your team before public release.)
