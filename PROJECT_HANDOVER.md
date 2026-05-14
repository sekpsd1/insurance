# Project Handover

Archive/reference note: this file is older broad context. Use `PROJECT_STATE.md` as the current handoff and read this file only when extra background is needed.

## 1) Project overview and business purpose
This repository is a LINE mini app for **car insurance quote browsing and purchase flow**.

It supports two main experiences:
- **Customer flow** in `/line-app` for searching insurance packages, comparing packages, and creating an order
- **Admin flow** in `/admin` and `/admin/insurance` for managing orders, campaigns, CSV imports, and campaign logos

Business purpose:
- Let users search insurance packages by vehicle details and coverage type
- Compare plans side by side before buying
- Let admins import and manage large insurance campaign datasets efficiently

## 2) Tech stack, framework, package manager, versions
### Framework / UI
- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS

### Data / backend
- Prisma ORM
- MySQL database
- Next.js Server Actions for form submits and admin actions

### Package manager
- The repo uses `npm` scripts in `package.json`

### Runtime notes
- **Node.js:** recommended `18.18+` or `20+`
- **PHP / Python:** not used in this repo

## 3) How to install dependencies
```bash
npm install
```

## 4) How to run the project locally
### 1. Create env file
Copy `.env.example` to `.env` and fill in the values.

### 2. Generate Prisma client
```bash
npm run prisma:generate
```

### 3. Run the dev server
```bash
npm run dev
```

### Optional local database tools
- `npm run prisma:studio`
- `npm run prisma:migrate`
- `npm run import:insurance`
- `npm run db:backup`

## 5) How to build and deploy
### Build
```bash
npm run build
```

### Run production build locally
```bash
npm run start
```

### Deploy notes
- `next.config.js` enables `output: 'standalone'` in production
- The repo is already set up for server deployment with MySQL and Prisma
- If deploying to Plesk or similar, ensure the production `DATABASE_URL` is set and Prisma client is generated during the build/deploy pipeline

## 6) Environment variables required
Do **not** commit real secret values.

Required or used variables:
- `DATABASE_URL` — MySQL connection string used by Prisma
- `ADMIN_PASSWORD` — password for `/admin/login`
- `DEMO_LINE_ID` — optional default LINE user ID for order form flows
- `MYSQL_ROOT_PASSWORD` — optional, used by backup scripts when dumping from Docker
- `MYSQL_CONTAINER_NAME` — optional, used by Docker backup script

## 7) Current completed features
- Search Premium page loads brand/model/year options from real database rows
- Results page filters by selected `coverage`, `brand`, `model`, and `year`
- Results page supports pagination and a compare selection flow
- Compare page displays selected packages side by side
- Compare page and results page preserve query parameters when navigating back and forth
- Campaign-level logo upload is supported in admin
- Imported campaigns can pass a `logoUrl` into imported packages
- Per-package logo upload was removed so logo management stays at campaign level
- Admin login flow exists with cookie-based auth
- Order creation flow exists for selected packages

## 8) Current unfinished tasks
- Add preview for uploaded logos in the import modal
- Add replace/delete logo controls on campaign cards
- Clean up old logo files after replacement
- Consider extracting shared query-string helpers for results/compare/search links
- Improve documentation around CSV column expectations if more import sources are added

## 9) Known bugs or broken areas
- Compare year can still show `-` if the imported CSV/database row has no `year`
- Old uploaded logo files are not deleted automatically when a new logo replaces them
- There is no separate API route layer; most write operations happen through server actions, so debugging often starts in `lib/actions.ts`
- If `ADMIN_PASSWORD` is missing, the admin login page intentionally redirects with a configuration error

## 10) Important files and folders
### App routes
- `app/page.tsx` — landing page with links to customer/admin flows
- `app/line-app/page.tsx` — search results page
- `app/line-app/search/page.tsx` — search form page
- `app/line-app/search/search-premium-form.tsx` — client-side search form component
- `app/line-app/compare/page.tsx` — compare table page
- `app/line-app/_components/compare-selection.tsx` — package card selection UI
- `app/line-app/form/[id]/page.tsx` — package purchase/order form
- `app/line-app/success/[orderId]/page.tsx` — success page after order creation
- `app/admin/page.tsx` — admin order dashboard
- `app/admin/login/page.tsx` — admin login page
- `app/admin/insurance/page.tsx` — campaign dashboard and import entry point
- `app/admin/insurance/packages/page.tsx` — package list and edit page
- `app/admin/insurance/_components/campaign-import-modal.tsx` — import modal UI

### Shared logic
- `lib/prisma.ts` — Prisma client singleton
- `lib/actions.ts` — server actions for imports, logo updates, order updates
- `lib/insurance-import.ts` — CSV parsing/import helpers and summary queries

### Database / schema
- `prisma/schema.prisma` — data model definitions

### Utilities / scripts
- `scripts/import-insurance.ts` — import script
- `scripts/db-backup.ts` / `scripts/db-backup.cjs` — database backup utilities
- `scripts/verify-db.ts` — quick DB verification script

### Static assets and uploads
- `public/uploads/logos` — uploaded campaign logos
- `csv/` — sample/import CSV files currently in the repo

## 11) Database/schema notes
Main models:
- `User`
- `InsurancePackage`
- `Order`

Important `InsurancePackage` fields:
- `companyCode`
- `campaignCode`
- `campaignName`
- `brand`
- `model`
- `year`
- `rawData`
- `logoUrl`
- `details`
- `repairType`
- `coverage`
- `fullPrice`
- `netPrice`
- `discount`

Useful schema notes:
- `InsurancePackage` is indexed by `[companyCode, campaignCode]`
- It is also indexed by `[brand, model, year]` for search performance
- Prisma datasource uses `env("DATABASE_URL")`

## 12) API routes / endpoints
There are no standalone `app/api/*/route.ts` endpoints in the current repo.

Write operations mostly happen through:
- Server Actions in page/component files
- Helpers in `lib/actions.ts`

Important browser routes:
- `/` — landing page
- `/line-app`
- `/line-app/search`
- `/line-app/compare`
- `/line-app/form/[id]`
- `/line-app/success/[orderId]`
- `/admin`
- `/admin/login`
- `/admin/insurance`
- `/admin/insurance/packages`

## 13) Authentication / login flow
Admin auth is simple cookie-based login.

Flow:
- User visits `/admin/login`
- Form submits to a server action inside `app/admin/login/page.tsx`
- Password is compared against `process.env.ADMIN_PASSWORD`
- On success, the app sets `admin_token=authenticated` cookie
- On failure, it redirects back with an error query string

Notes:
- This is not a full RBAC system
- The cookie is used to gate admin pages

## 14) Styling / UI conventions
- Tailwind CSS utility classes are used throughout
- Pages are built with rounded cards, soft shadows, and blue/cyan brand accents
- The customer-facing flow uses a mobile-first layout
- Admin views favor wider desktop layouts with dense tables/cards
- Thai is used in user-facing labels and messages, with some English route/page labels retained

## 15) Testing / linting commands
```bash
npm run lint
npx tsc --noEmit
npm run build
```

Other helpful commands:
```bash
npm run prisma:generate
npm run prisma:studio
npm run prisma:migrate
npm run import:insurance
npm run db:backup
```

## 16) Recent decisions made in Windsurf
- Search page was converted to a server-rendered page that loads vehicle options from the database
- Results page filters directly by selected car data rather than showing all packages
- Compare flow was changed to preserve query parameters across navigation
- Campaign logos are managed at campaign level instead of per package
- Import modal now supports a logo file upload so new campaigns can carry branding
- The compare year display remains data-driven; fallback `-` is intentional when DB data is missing

Commit reference:
- `8bcf35d` — `Implement campaign logo upload and compare flow fixes`

## 17) Recommended next steps for Codex App
- Verify `.env.example` matches any new environment variables added later
- Consider adding a logo preview in the import modal
- Add automatic cleanup for replaced logo files
- Review whether compare/results query handling should be centralized in a shared helper
- If year values should always show, inspect the import source CSVs and mapping logic rather than the compare page UI

## Quick start summary for the next agent
1. Copy `.env.example` to `.env`
2. Set `DATABASE_URL` and `ADMIN_PASSWORD`
3. Run `npm install`
4. Run `npm run prisma:generate`
5. Run `npm run dev`

This repo is ready for continued work without rewriting the app.
