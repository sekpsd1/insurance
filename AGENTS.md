# Agent Instructions

This repository is a Next.js 15 App Router application for a car insurance LINE Mini App style customer flow, admin/broker operations, and insurance provider Magic Link status updates.

## Start Here

Before making changes, read:

1. `PROJECT_STATE.md` for the latest project state and next recommended steps.
2. `PROJECT_HANDOVER.md` for broader context.
3. `IMPLEMENTATION_BLUEPRINT.md` if the task touches architecture or larger flows.

Treat `PROJECT_STATE.md` as the current handoff. Keep it updated after meaningful feature work.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- MySQL
- Server Actions for writes

## Important Routes

- Customer flow starts at `/line-app/search`.
- Customer results and package selection live under `/line-app`.
- Checkout is `/line-app/checkout/[orderId]`.
- Customer success is `/line-app/success/[orderId]`.
- Customer tracking is `/line-app/tracking` and `/line-app/tracking/[orderNumber]`.
- Admin routes live under `/admin`.
- Provider Magic Link route is `/insurance/update/[token]`.

LINE rich menu and LIFF consent are out of scope for this web app for now.

## Development Notes

- Prefer existing code patterns over new abstractions.
- Keep user-facing text in Thai where the surrounding UI is Thai.
- Keep internal enum/status values unchanged; map them to Thai labels for display.
- Use `lib/status-labels.ts` for status/payment/email/timeline display labels.
- Avoid editing large Thai copy through tools that display mojibake unless necessary; verify in browser when copy matters.
- Use server actions in `lib/actions.ts` for writes.
- Use Prisma relations and structured queries instead of ad hoc data handling.

## Prisma / Database

- Prisma schema is `prisma/schema.prisma`.
- Local DB is MySQL from `docker-compose.yml`.
- After schema changes, run:
  - `npx prisma validate`
  - `npx prisma generate`
  - `npx prisma db push` for local sync, unless a proper migration is explicitly requested.
- `EmailOutbox` is the provider email audit/outbox table.
- Magic Link raw tokens are not stored; only SHA-256 hashes are stored in `MagicLinkToken`.

## Email Outbox Flow

- Checkout creates a provider Magic Link and an `EmailOutbox` row.
- Admin can send/retry outbox rows from `/admin`.
- Current sender is mocked by `sendProviderEmailMock`; it does not send real email.
- Production should replace the mock sender with SMTP/Resend/SendGrid/SES while preserving outbox audit updates.
- Do not show recipient email addresses in customer-facing timeline messages.
- Avoid creating duplicate visible outbox rows for the same order; reuse or refresh the latest row.

## Provider Magic Link Flow

- Provider page `/insurance/update/[token]` should show enough detail for insurer staff to make a decision:
  - customer contact and address
  - ID card number when present
  - vehicle and plate
  - selected package, repair type, coverage, amount
  - payment method/status
  - payment slip or gateway link when present
- Provider can update:
  - `INSURER_REVIEWING`
  - `POLICY_APPROVED`
  - `POLICY_ISSUED`
  - `REJECTED`
- Updates must write `OrderStatusHistory`.

## Verification

Run these before finishing meaningful code changes:

- `npx tsc --noEmit`
- `npx prisma validate` if Prisma or DB-related code changed
- `npm run build`

Known build warnings:

- Next.js warns about `<img>` usage in compare pages. This is known and currently acceptable.

## Local Server Notes

On this Windows machine, `next dev` can fail or hang with `spawn EPERM` or stale `.next` chunks.

If dev mode is unstable:

1. Stop old Node/Next processes.
2. Clear `.next` if stale chunks are suspected.
3. Run `npm run build`.
4. Start with `npm run start`.

When starting/stopping local servers, verify routes with `Invoke-WebRequest`, for example:

- `http://localhost:3000/admin`
- `http://localhost:3000/admin/insurance`
- `http://localhost:3000/line-app/search`

## Git Hygiene

- Do not commit `tsconfig.tsbuildinfo`; it is generated and may change after typecheck/build.
- Do not commit `.next`, `node_modules`, local uploaded slips, or other generated artifacts.
- Check `git status --short` before staging.
- Stage only files related to the task.
- After coherent slices, commit and push when requested by the user.

## Current Product Decisions

- Customer flow starts at `/line-app/search`.
- First class insurance is removed from the customer-facing flow.
- Campaign logos are managed at campaign level, not per package.
- Provider Contact is stored on `InsurancePackage` rows and updated across packages in the same campaign.
- Admin/broker primarily manages insurance data and monitors orders; provider Magic Link is the main mechanism for provider-side status updates.
- Real email and LINE integrations are not implemented yet; logs/mock sender are used for local MVP testing.
