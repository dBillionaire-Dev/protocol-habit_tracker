# Protocol - A Serious System for Personal Discipline

A full-stack habit-tracking application with zero tolerance for excuses: every missed day owes a debt, every completed day extends a streak, and none of it is graded on a curve. Built with Next.js 16, TypeScript, Supabase, and Paystack.

## Overview

Protocol tracks two kinds of habits:

1. **Build Habits** - habits you want to show up for daily (exercise, reading, a coding streak). Complete the day's task to extend your streak. Miss a day and it becomes a whole day of **debt**, tracked separately from your streak, repayable in part or in full whenever you choose.
2. **Avoidance Habits** - habits you want to eliminate (smoking, doom-scrolling). Every slip is logged as a violation the instant it happens; a clean day only counts once you explicitly confirm it — no silent passes.

Both types support a daily **confirmation window** (9:00 PM–midnight, server-enforced) during which the day's outcome is locked in. Premium Plus bypasses this window entirely (see Plans below). On top of the core tracking, Protocol has grown into a real SaaS product: subscription billing, trials, a referral program, shared "streak partner" accountability, push notifications, offline support, and a separate admin console.

## Features

### Core habit tracking
- **Build habits** - streaks, debt (missed days), and a stacking penalty level for repeated misses
- **Avoidance habits** - violation logging, debt, and explicit clean-day confirmation
- **Custom Protocol Rules** (Pro/Premium Plus) - restrict a Build habit to specific days of the week; days outside the schedule are rest days, not misses
- **Confirmation window** - 9PM–midnight for everyone on Free/Pro; Premium Plus can confirm any day, any time
- **Habit editing** - Free plan can edit a habit only within 20 minutes of creating it; Pro/Premium Plus can edit anytime
- **History & analytics** - full day-by-day history with CSV export (Pro/Premium Plus), debt-repayment auditing, and a dedicated analytics dashboard
- **Offline support** - the service worker caches API GETs for offline viewing; a client-side queue captures `complete`/`mark-missed`/`confirm-clean-day` actions taken while offline and replays them automatically on reconnect (see `client/src/lib/offline-queue.ts`)

### Accounts & billing
- **Auth**: Supabase Auth — Google OAuth, email/password, and a stateless Guest mode (browser `localStorage` only, auto-expires after 24 hours)
- **Sessions**: real accounts get an independent 7-day enforcement on top of Supabase's own session, keyed off `users.last_login_at` (stamped only on genuine sign-in events), see `client/src/lib/auth/require-user.ts`
- **Plans**: Free, Pro, Premium Plus, billed monthly or annually in NGN via **Paystack**
- **Subscription trials** - one-time Free→Pro (7d), Free→Premium Plus (3d), and Pro→Premium Plus (7d, reverts to Pro not Free) trials, each enforced server-side and reminder-emailed via Resend
- **Referral program** - invite links with attribution and rewards
- **Manage Subscription** - in-app plan changes, cancellation with a grace period through the current billing period, and trial status

### Together / social
- **Streak Partners** (Pro/Premium Plus) - invite another Protocol user to pair a Build habit with yours; once accepted, a matching habit is auto-created for them and a shared streak is derived from both people's daily completion (only counts when BOTH complete). Individual streaks, debt, and history always stay completely separate — see `shared/schema.ts`'s `habit_partnerships` table comment for the full design reasoning.

### Notifications
- **Web Push** - VAPID-based push notifications (subscribe/unsubscribe, per-category preferences) for the confirmation window opening, both while the app is open (instant local notification) and closed (a daily Vercel Cron sweep)
- **Trial and billing reminder emails** via Resend

### AI (Premium Plus, Gemini-powered)
- **AI Discipline Insights** and **AI Protocol Planning** - see `client/src/app/ai/page.tsx` and `client/src/lib/gemini.ts`

### PWA
- Installable as its own app - manifest, icons, and a custom animated splash screen (see `client/src/components/protocol-splash.tsx`)
- **`/admin` is a second, separately-installable PWA** - "Protocol Admin," with its own manifest, red-accented icon set, and its own splash screen animation, distinct from the main "Protocol" install

### Admin console (`/admin`)
- Two admin tiers: `super_admin` (env-controlled via `SUPER_USER_EMAILS`, matches the main app's super-user preview flag, can never be locked out by a bad DB write) and `support_admin` (assignable per-user, DB-stored)
- User management (suspend/restore, change plan), subscriptions overview, referrals, support tickets, an audit log of every admin action, system event log, and habit analytics

## System Architecture

### Frontend
- **Framework**: Next.js 16 (App Router, Turbopack) with TypeScript
- **State**: TanStack React Query for server state
- **Styling**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod

### Backend
- **Runtime**: Next.js Route Handlers (`client/src/app/api/**`) — no separate server process
- **Session refresh**: `client/src/proxy.ts` (Next.js 16 renamed `middleware.ts` → `proxy.ts`) refreshes the Supabase session cookie on every request
- **Cron**: Vercel Cron hits `api/cron/trial-reminders` and `api/cron/confirmation-window-push` daily (Vercel Hobby plan caps cron at once/day per job, see the comments in `vercel.json` and those two routes for how the reminder schedule was designed around that limit)

### Data
- **Database**: Supabase Postgres (17 tables — habits, habit debt/repayment history, subscriptions & trials, referrals, push subscriptions & notification preferences, bug reports, streak partnerships, and the admin audit/support/system-event tables)
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with Zod validation (drizzle-zod), schema in `shared/schema.ts` + `shared/models/`
- **Migrations**: `pnpm db:push`. Uses **two different Supabase connection strings** — `DATABASE_URL` (Transaction pooler, port 6543, used by the app at runtime) and `DIRECT_DATABASE_URL` (Session pooler, port 5432, used only by `drizzle-kit push`/`studio`, the Transaction pooler doesn't support the prepared statements schema introspection needs). See `drizzle.config.ts` and `client/.env.example`.

### Integrations
- **Supabase**: auth + Postgres
- **Paystack**: subscription billing (NGN)
- **Resend**: transactional email (trial/billing reminders, bug report notifications)
- **web-push**: Web Push notifications (self-hosted VAPID keys, not a third-party push service)
- **Google Gemini**: AI insights/planning (Premium Plus)

```
Google / Email+Password
  │
  ▼
Supabase Auth
  │
  ▼
Next.js Frontend + Route Handlers (Vercel)
  │            │           │
  ▼            ▼           ▼
Supabase    Paystack    Resend / web-push / Gemini
Postgres    (billing)   (notifications, AI)
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (this repo is a pnpm workspace — see `pnpm-workspace.yaml`)
- A Supabase project (Postgres + Auth)
- A Paystack account (for billing — optional if you're only working on habit-tracking features)

### Installation

```bash
# From the repo root (a pnpm workspace: client/ + shared/)
pnpm install

# Copy the env file into client/, where the app actually reads it —
# the root .env.example is a lighter/older subset; client/.env.example
# is the authoritative, current one.
cp client/.env.example client/.env

# Fill in client/.env — at minimum: NEXT_PUBLIC_SUPABASE_URL,
# NEXT_PUBLIC_SUPABASE_ANON_KEY, DATABASE_URL, DIRECT_DATABASE_URL.
# Enable the Google provider under Supabase's Authentication -> Providers
# if you want Google sign-in, with a redirect URI of
# `<your Supabase URL>/auth/v1/callback`.

# Push the schema
pnpm db:push

# Start the dev server
pnpm dev
```

### Environment Variables

See `client/.env.example` for the full, current, commented list, it's the source of truth (the root `.env.example` predates several features and is missing entries). Grouped summary:

| Group | Variables |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Database | `DATABASE_URL` (Transaction pooler, runtime), `DIRECT_DATABASE_URL` (Session pooler, migrations only) |
| App | `NEXT_PUBLIC_APP_URL` |
| Paystack | `PAYSTACK_SECRET_KEY`, `PAYSTACK_PRO_MONTHLY_PLAN_CODE`, `PAYSTACK_PRO_ANNUAL_PLAN_CODE`, `PAYSTACK_PREMIUM_PLUS_MONTHLY_PLAN_CODE`, `PAYSTACK_PREMIUM_PLUS_ANNUAL_PLAN_CODE` |
| Email (Resend) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Push (web-push) | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_CONTACT_EMAIL` (generate your own with `npx web-push generate-vapid-keys`) |
| Cron | `CRON_SECRET` (Vercel auto-attaches this as a bearer token to cron-invoked requests) |
| AI | `GEMINI_API_KEY`, `GEMINI_MODEL` (optional, defaults to `gemini-3.5-flash`) |
| Support/contact | `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_SUPPORT_PHONE`, `NEXT_PUBLIC_DEVELOPER_EMAIL` |
| Admin | `SUPER_USER_EMAILS` (comma-separated, full access to every tier, plan-preview, and `super_admin` on `/admin`) |

Google OAuth credentials (client ID/secret) are configured in the Supabase dashboard, not as env vars here. The 7-day session-persistence enforcement described above is app-level (`require-user.ts`); Supabase's own **Authentication → Sessions → Inactivity timeout** project setting should also be set to match, since that's what actually revokes the underlying refresh token.

## Project Structure

```
protocol-habit_tracker/            # pnpm workspace root ("protocol-root")
├── client/                        # the Next.js app
│   ├── public/                    # static assets, PWA manifests + icons (main + admin)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/               # Route Handlers (habits, billing, partnerships, push, admin, cron, ...)
│   │   │   ├── admin/             # /admin console pages
│   │   │   ├── dashboard/         # main authenticated dashboard
│   │   │   ├── partners/          # Streak Partners page
│   │   │   ├── pricing/ | home/ | terms/ | privacy/   # public marketing/legal pages
│   │   │   ├── forgot-password/ | reset-password/
│   │   │   ├── layout.tsx         # root layout - metadata, splash, service worker
│   │   │   └── page.tsx           # sign-in/sign-up
│   │   ├── components/
│   │   │   ├── ui/                # shadcn/ui primitives
│   │   │   ├── admin/             # admin-only components (admin-shell, stat cards)
│   │   │   ├── habit-card.tsx, layout-shell.tsx, protocol-splash.tsx, admin-splash.tsx, ...
│   │   ├── hooks/                 # React Query hooks (use-habits, use-billing, use-partnerships, ...)
│   │   ├── lib/
│   │   │   ├── supabase/          # browser + server Supabase clients
│   │   │   ├── auth/              # resolveUser() - shared by every route handler
│   │   │   ├── admin/             # admin auth guard + admin-only storage
│   │   │   ├── paystack/          # Paystack API + plan/pricing config
│   │   │   ├── email/             # Resend wrapper
│   │   │   ├── db.ts              # Drizzle client (Supabase Postgres, IPv4-forced DNS lookup)
│   │   │   ├── storage.ts         # main data-access layer used by route handlers
│   │   │   ├── offline-queue.ts   # client-side offline action queue
│   │   │   └── gemini.ts          # Gemini client for AI features
│   │   └── proxy.ts               # Supabase session-refresh (formerly middleware.ts pre-Next-16)
│   └── public/sw.js                # service worker: cache-first GETs + Web Push handlers
├── shared/                        # schema.ts + models/, imported by client/ as a workspace package
├── drizzle.config.ts
├── pnpm-workspace.yaml
└── package.json                   # root workspace scripts (delegates into client/)
```

## Available Scripts

Run from the repo root:

| Command | Description |
|---|---|
| `pnpm dev` | Start the Next.js dev server (delegates to `client/`) |
| `pnpm build` | Production build |
| `pnpm start` | Start the production server |
| `pnpm db:push` | Push `shared/schema.ts` to the database (uses `DIRECT_DATABASE_URL`) |
| `pnpm db:studio` | Open Drizzle Studio |

## Tech Stack

Next.js 16 · TypeScript · Tailwind CSS · Supabase (Postgres + Auth) · Drizzle ORM · TanStack Query · Radix UI / shadcn/ui · Framer Motion · React Hook Form + Zod · Paystack · Resend · web-push · Google Gemini

## Known Issues

Flagging honestly rather than silently, these are real, currently-present gaps as of this writing:

- **`storage.acceptPartnership` signature mismatch**: `api/partnerships/[id]/accept/route.ts` calls it with 2 arguments (habit is now auto-created for the accepting partner), but `storage.ts`'s implementation still requires a 3rd `partnerHabitId` argument. This compiles under `next build`'s Turbopack pipeline but is a real runtime bug. Accepting a partnership will currently fail. Needs `storage.ts` updated to match the route's auto-create-habit contract.
- **`AdminContext` missing `.email`/`.id`**: `api/admin/support/[id]/reply` and `.../status` reference fields not declared on that type.
- **`lib/db.ts`'s `lookup` option**: a deliberate IPv4-forcing DNS fix for the pg Pool, but `@types/pg`'s `PoolConfig` type doesn't declare a `lookup` property. A type-declaration gap, not a runtime bug.

## License

MIT
