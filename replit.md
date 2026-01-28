# PROTOCOL - Personal Discipline Tracking System

## Overview

PROTOCOL is a full-stack habit tracking Progressive Web App (PWA) designed for strict personal accountability. The application allows users to define and track two types of habits:

1. **Avoidance Habits** (Debt-based): Track bad habits like porn, junk food, or social media. Each occurrence adds debt that must be worked off through clean days.

2. **Build Habits** (Penalty-stacking): Track positive habits like exercise or reading. Missing daily tasks increases penalty levels, making subsequent days harder.

The app uses a time-restricted confirmation window (11 PM - 12 AM) for daily habit confirmations, with automatic processing at midnight.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for micro-interactions
- **Build Tool**: Vite with custom plugins for Replit integration

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
- **Primary**: Replit Auth (OpenID Connect)
- **Guest Mode**: Demo user support for testing without authentication
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`

### Project Structure
```
├── client/           # React frontend
│   ├── src/
│   │   ├── components/   # UI components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── pages/        # Page components
│   │   └── lib/          # Utilities
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations
│   └── replit_integrations/  # Auth integration
├── shared/           # Shared code (schemas, types, routes)
└── migrations/       # Database migrations
```

### Key Design Patterns
- **Shared Schema**: Database schemas defined in `shared/schema.ts` are used by both frontend (for type safety) and backend (for database operations)
- **API Contract**: Route definitions in `shared/routes.ts` with Zod validation ensure type-safe API calls
- **Component Library**: shadcn/ui components in `client/src/components/ui/` provide consistent styling

## External Dependencies

### Database
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **Drizzle ORM**: Type-safe database queries and schema management

### Authentication
- **Replit Auth**: OpenID Connect authentication provider
- **Required Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `SESSION_SECRET`: Session encryption key
  - `ISSUER_URL`: Replit OIDC issuer (defaults to `https://replit.com/oidc`)
  - `REPL_ID`: Replit environment identifier

### Frontend Libraries
- **@tanstack/react-query**: Server state management and caching
- **date-fns**: Date formatting and manipulation
- **framer-motion**: Animation library
- **lucide-react**: Icon library
- **Radix UI**: Headless UI primitives for shadcn/ui

### Development Tools
- **Vite**: Frontend build tool with HMR
- **esbuild**: Server bundling for production
- **TypeScript**: Type checking across the codebase