# Protocol - Personal Discipline Tracking System

A serious framework for tracking habits with debt and penalty systems. Built with Next.js 16 and TypeScript.

## Overview

PROTOCOL is a full-stack habit tracking Progressive Web App (PWA) designed for strict personal accountability. The application allows users to define and track two types of habits:

1. **Avoidance Habits** (Debt-based): Track bad habits like smoking, junk food, or social media. Each occurrence adds debt that must be worked off through clean days.

2. **Build Habits** (Penalty-stacking): Track positive habits like exercise or reading. Missing daily tasks increases penalty levels, making subsequent days harder.

The app uses a time-restricted confirmation window (10 PM - 12 AM) for daily habit confirmations, with automatic processing at midnight.

## User Preferences

Preferred communication style: Simple, everyday language.

## Features

- **Avoidance Habits**: Track bad habits with debt accumulation
- **Build Habits**: Track good habits with penalty stacking
- **Day Confirmation Window**: 11 PM - 12 AM daily confirmation period
- **Streak System**: Track current and longest streaks
- **Dark Theme**: Serious, high-contrast dark theme by default

## System Architecture

### Frontend Architecture
- **Framework**: Next.js 16 with TypeScript
- **Routing**: Next.js router (File-based routing)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for micro-interactions
- **Build Tool**: Next.js

### Backend Architecture
- **Runtime**: Next.js Route Handlers (`client/src/app/api/**`) — no separate server process
- **Language**: TypeScript
- **API Pattern**: RESTful JSON API under `/api/*` routes, same-origin with the frontend
- **Session Management**: Stateless. Real users authenticate via Supabase Auth (session lives in an httpOnly cookie managed by `@supabase/ssr`); guest mode is a client-tracked flag sent as an `X-Guest-Mode` header — no server-side session store at all

### Data Storage
- **Database**: Supabase Postgres
- **ORM**: Drizzle ORM (`drizzle-orm/node-postgres`) with Zod validation (drizzle-zod)
- **Schema Location**: `shared/schema.ts` for types shared across the app
- **Migrations**: Managed via `drizzle-kit push`
- **Storage**: Supabase Storage (planned, for future file/image uploads)

### Authentication
- **Primary**: Supabase Auth - Google OAuth (hosted flow, redirects through `/auth/callback`)
- **Secondary**: Supabase Auth - email/password
- **Guest Mode**: Stateless demo user, no Supabase session or DB row required

```
Google
  │
  ▼
Supabase Auth (Google)
  │
  ▼
Next.js Frontend + Route Handlers (Vercel)
  │
  ▼
Supabase Postgres + Supabase Storage
```

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project (Postgres + Auth)
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file (into client/, where Next.js reads it)
cp .env.example client/.env

# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and
# DATABASE_URL from your Supabase project (Project Settings -> API and
# -> Database). Also enable the Google provider under Supabase's
# Authentication -> Providers, with your Google OAuth client ID/secret and
# a redirect URI of `<your Supabase URL>/auth/v1/callback`.

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

| Variable                        | Description                                         |
|----------------------------------|------------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | Supabase project URL                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Supabase anon/public API key                          |
| `DATABASE_URL`                   | Supabase Postgres connection string                   |
| `NEXT_PUBLIC_APP_URL`            | Public app URL, used for OAuth redirect construction  |

Google OAuth credentials (client ID/secret) are configured directly in the
Supabase dashboard, not as env vars in this app.

## Project Structure

```
nextjs/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   ├── habits/      # Habits CRUD endpoints
│   │   │   └── user/        # User preferences
│   │   ├── dashboard/       # Protected dashboard page
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Landing page
│   ├── components/
│   │   ├── ui/              # Reusable UI components
│   │   ├── habit-card.tsx   # Habit display card
│   │   ├── layout-shell.tsx # Dashboard layout
│   │   └── ...
│   ├── hooks/                # Custom React hooks
│   ├── lib/
│   │   ├── supabase/          # Browser + server Supabase clients
│   │   ├── auth/              # resolveUser() — shared by every route handler
│   │   ├── db.ts               # Drizzle client (Supabase Postgres)
│   │   ├── storage.ts          # Data-access layer used by route handlers
│   │   └── api.ts               # Client-side fetch wrapper (guest-mode header)
│   └── middleware.ts          # Refreshes the Supabase session cookie
├── shared/                    # schema.ts + models, shared across the app
├── drizzle.config.ts          # Drizzle ORM config
├── tailwind.config.ts         # Tailwind CSS config
└── tsconfig.json              # TypeScript config
```

## Key Implementation

### Habits System

#### Avoidance Habits
- Track bad habits you want to eliminate
- Each incident increases debt
- Clean days reduce debt
- Streaks track consecutive clean days

#### Build Habits
- Track positive habits you want to build
- Missed days increase penalty level
- Penalty increases required task amount
- Streaks track consecutive successful days

### Day Confirmation Window

The day confirmation window is open from 11:00 PM to 12:00 AM. During this window:
- Build habits can be marked as complete or missed
- Avoidance habits can be confirmed as clean days
- Actions outside this window won't count

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push schema changes to database |
| `pnpm db:studio` | Open Drizzle Studio |

## Tech Stack

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **State Management**: TanStack Query (React Query)
- **UI Components**: Radix UI primitives
- **Animations**: Framer Motion
- **Forms**: React Hook Form + Zod

## Visual Design

The UI maintains 100% visual resemblance to the original design:
- Dark theme by default with high contrast
- Minimalist, serious aesthetic
- Monospace fonts for data display
- Consistent spacing and typography
- Responsive design for all screen sizes

## License

MIT
