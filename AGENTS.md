# Agent Instructions

This is a Next.js 15 App Router app for a car insurance LINE Mini App style customer flow, admin/broker operations, and insurance provider Magic Link status updates.

## Read First

Before changing code, read only:

1. `PROJECT_STATE.md` - current handoff, latest decisions, and next steps.

Read these only when needed:

- `PROJECT_SUMMARY.md` - human-friendly project summary.
- `PROJECT_HANDOVER.md` - older broad context.
- `IMPLEMENTATION_BLUEPRINT.md` - older architecture plan for larger flow changes.

Keep `PROJECT_STATE.md` updated after meaningful feature work.

## Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- MySQL
- Server Actions for writes

## Core Routes

- Customer start: `/line-app/search`
- Customer results/selection: `/line-app`
- Checkout: `/line-app/checkout/[orderId]`
- Customer success: `/line-app/success/[orderId]`
- Customer tracking: `/line-app/tracking` and `/line-app/tracking/[orderNumber]`
- Admin: `/admin`
- Provider Magic Link: `/insurance/update/[token]`

LINE rich menu and LIFF consent are currently out of scope for this web app.

## Product Rules

- Keep user-facing Thai text where surrounding UI is Thai.
- Keep internal enum/status values unchanged; map them to Thai labels for display.
- Use `lib/status-labels.ts` for status, payment, email, and timeline labels.
- Use server actions in `lib/actions.ts` for writes.
- Use Prisma relations and structured queries.
- Prefer existing patterns over new abstractions.

## Payment Rules

- This app must not receive or hold customer payment directly.
- Bank transfer goes directly to the insurance company's bank account.
- Online/card/gateway payment links out to the insurance company's own payment URL.
- Payment setup is campaign-level.
- Customer bank transfer slips stay uploaded here and must be visible on the provider Magic Link page.
- Provider staff review slips from the Magic Link page and decide policy status.
- Do not add a broker/admin slip approval gate unless the product decision changes.

## Provider Magic Link Rules

- Route: `/insurance/update/[token]`.
- Store only SHA-256 token hashes in `MagicLinkToken`; do not store raw tokens.
- Provider page must show enough order, customer, vehicle, package, and payment detail for insurer review.
- Provider can update only:
  - `INSURER_REVIEWING`
  - `POLICY_APPROVED`
  - `POLICY_ISSUED`
  - `REJECTED`
- Provider updates must write `OrderStatusHistory`.

## Email Outbox Rules

- Checkout creates a provider Magic Link and `EmailOutbox` row.
- Current sender is `sendProviderEmailMock`; real email is not implemented yet.
- Admin can send/retry outbox rows from `/admin`.
- Do not show recipient email addresses in customer-facing timeline messages.
- Reuse or refresh the latest visible outbox row for an order instead of creating duplicate rows.

## Verification

Run before finishing meaningful code changes:

- `npx tsc --noEmit`
- `npx prisma validate` if Prisma or DB-related code changed
- `npm run build`

Known acceptable warnings:

- Next.js warns about `<img>` usage in compare/checkout image areas.

## Local Server Notes

On this Windows machine, `next dev` can fail or hang with stale `.next` chunks.

If local server is unstable:

1. Stop old Node/Next processes.
2. Clear `.next`.
3. Run `npm run build`.
4. Start with `npm run start`.

Verify routes with `Invoke-WebRequest`, for example:

- `http://localhost:3000/admin`
- `http://localhost:3000/admin/insurance`
- `http://localhost:3000/line-app/search`

## Git Hygiene

- Do not commit `tsconfig.tsbuildinfo`.
- Do not commit `.next`, `node_modules`, local uploaded slips/logos/payment QR images, or generated artifacts.
- Check `git status --short` before staging.
- Stage only files related to the task.
- Commit and push only when requested.
