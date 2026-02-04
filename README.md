# Protocol - Personal Discipline Tracking System (Next.js 16)

A serious framework for tracking habits with debt and penalty systems. Built with Next.js 16 and TypeScript.

## Overview

PROTOCOL is a full-stack habit tracking Progressive Web App (PWA) designed for strict personal accountability. The application allows users to define and track two types of habits:

1. **Avoidance Habits** (Debt-based): Track bad habits like smoking, junk food, or social media. Each occurrence adds debt that must be worked off through clean days.

2. **Build Habits** (Penalty-stacking): Track positive habits like exercise or reading. Missing daily tasks increases penalty levels, making subsequent days harder.

The app uses a time-restricted confirmation window (11 PM - 12 AM) for daily habit confirmations, with automatic processing at midnight.

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
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: RESTful JSON API under `/api/*` routes
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with Zod validation (drizzle-zod)
- **Schema Location**: `shared/schema.ts` for shared types between client and server
- **Migrations**: Managed via `drizzle-kit push`

### Authentication
- **Primary**: Google Auth (OpenID Connect)
- **Secondary**: Email Auth (Magic Link)
- **Guest Mode**: Demo user support for testing without authentication
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Update DATABASE_URL in .env with your PostgreSQL connection string

# Run database migrations
pnpm db:push

# Start development server
pnpm dev
```

### Environment Variables

| Variable               | Description                           |
|------------------------|---------------------------------------|
| `DATABASE_URL`         | PostgreSQL connection string          |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID (optional)     |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret (optional) |
| `SESSION_SECRET`       | Session encryption secret             |

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
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utility functions
│   └── types/               # TypeScript types
├── drizzle.config.ts        # Drizzle ORM config
├── tailwind.config.ts       # Tailwind CSS config
└── tsconfig.json            # TypeScript config
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
