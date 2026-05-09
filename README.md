# LINE Mini App Insurance

Next.js 15 + TypeScript + Tailwind CSS + Prisma project for a car insurance mini app.

## Overview

The app has two main surfaces:

- **Customer flow** under `/line-app`
- **Admin flow** under `/admin` and `/admin/insurance`

Core capabilities:

- Search insurance plans by vehicle brand, model, year, and coverage
- Compare selected plans side by side
- Create an order from the selected plan
- Import insurance campaigns from CSV in the admin panel
- Upload and manage campaign logos at campaign level

## Tech stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- MySQL

## Requirements

- Node.js 18.18+ or 20+
- npm
- MySQL database

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment file:
   ```bash
   copy .env.example .env
   ```
3. Fill in `DATABASE_URL` and `ADMIN_PASSWORD` in `.env`.
4. Generate the Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```

## Useful scripts

- `npm run dev` — start the local dev server
- `npm run build` — build for production
- `npm run start` — run the production build
- `npm run lint` — run Next.js linting
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:migrate` — create/apply Prisma migrations
- `npm run prisma:studio` — open Prisma Studio
- `npm run import:insurance` — run insurance CSV import script
- `npm run db:backup` — run MySQL backup helper

## Environment variables

See `.env.example` for the expected keys. Do not commit secret values.

Required or used variables:

- `DATABASE_URL`
- `ADMIN_PASSWORD`
- `DEMO_LINE_ID`
- `MYSQL_ROOT_PASSWORD`
- `MYSQL_CONTAINER_NAME`

## Important routes

- `/` — landing page
- `/line-app/search` — search form
- `/line-app` — results page
- `/line-app/compare` — comparison table
- `/line-app/form/[id]` — order form for a selected package
- `/line-app/success/[orderId]` — order success page
- `/admin/login` — admin login
- `/admin` — order dashboard
- `/admin/insurance` — campaign dashboard and import entry point
- `/admin/insurance/packages` — package management

## Build and deploy

### Local production build

```bash
npm run build
npm run start
```

### Deployment notes

- `next.config.js` enables `output: 'standalone'` in production
- Ensure `DATABASE_URL` is set in the deployment environment
- Run `npm run prisma:generate` as part of the build/deploy pipeline if Prisma client is missing

## Current implementation notes

- Search and compare pages preserve query parameters when navigating
- Compare data comes directly from the selected package IDs and active filters
- Campaign logos are managed at campaign level, not per package
- Imported campaigns can propagate a `logoUrl` into imported packages
- The compare year column still shows `-` if the database row has no year value

## Testing / validation

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Documentation for maintainers

If you are extending this project, also read:

- `PROJECT_HANDOVER.md`
- `prisma/schema.prisma`
- `lib/actions.ts`
- `lib/insurance-import.ts`

