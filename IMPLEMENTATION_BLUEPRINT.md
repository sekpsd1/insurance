# Insurance Mini App Implementation Blueprint

## Goal

Build the app toward the 14-screen product flow:

- Customer LINE Mini App flow
- Broker admin dashboard flow
- Insurance company magic-link status update flow

This document is the implementation map before changing the database schema or adding migrations.

## Current Baseline

The project already has:

- Customer search page: `/line-app/search`
- Customer search results page: `/line-app`
- Customer comparison page: `/line-app/compare`
- Basic policy/order form: `/line-app/form/[id]`
- Basic success page: `/line-app/success/[orderId]`
- Admin login: `/admin/login`
- Admin order dashboard: `/admin`
- Admin campaign dashboard: `/admin/insurance`
- Admin package management: `/admin/insurance/packages`
- CSV import for insurance campaigns
- Campaign-level logo upload

The current database is intentionally simple:

- `User`
- `InsurancePackage`
- `Order`

`Order` currently stores only the minimum purchase state: order number, status, user, selected package, plate number, and tracking number.

## Product Screens And Routes

### Customer Flow

1. LINE chat + rich menu
   - Not a Next.js page yet.
   - Later work: LINE rich menu config/assets and LIFF entry URL.

2. Consent
   - External LINE Mini App / LIFF responsibility.
   - Not implemented as an in-system page.
   - The web app flow starts after LINE-side consent is already handled.

3. Search Premium
   - Existing route: `/line-app/search`
   - Keep as the main vehicle search form.

4. Search Results
   - Existing route: `/line-app`
   - Keep as package cards and compare selection entry.

5. Comparison Table
   - Existing route: `/line-app/compare`
   - Keep as side-by-side package comparison.

6. Policy Info
   - Existing route: `/line-app/form/[id]`
   - Proposed role change: collect policy/customer details and create a draft order.
   - After submit: redirect to `/line-app/checkout/[orderId]`.

7. Hybrid Checkout
   - Proposed route: `/line-app/checkout/[orderId]`
   - Payment methods:
     - Bank transfer with slip upload
     - Card/gateway handoff link
   - After submit: redirect to `/line-app/success/[orderId]`.

8. Payment Success
   - Existing route: `/line-app/success/[orderId]`
   - Expand to show payment/order summary and next steps.

9. Order Tracking
   - Proposed route: `/line-app/tracking`
   - Optional direct route: `/line-app/tracking/[orderNumber]`
   - Lets customer check order/payment/policy status.

### Admin Flow

10. Package Management
   - Existing route: `/admin/insurance/packages`
   - Later expand fields for discounts, display flags, gateway URL, and manual package edits.

11. Order Management
   - Existing route: `/admin`
   - Expand from simple status buttons into a full order table with payment, slip, policy info, and insurer status.

### Insurance Company Magic Link Flow

12. Insurance Email Template
   - No route required for production email, but add preview route if useful:
   - Proposed preview route: `/admin/orders/[orderId]/email-preview`

13. Magic Link Webpage
   - Proposed route: `/insurance/update/[token]`
   - Lets insurer update policy status and add a note.

14. LINE Push Notification Preview/System
   - Preview/mock route can be added later:
   - Proposed preview route: `/admin/orders/[orderId]/line-preview`
   - Production integration later uses LINE Messaging API.

## Proposed Status Model

Use status strings first for low migration risk. Enums can be introduced later if the workflow is stable.

### Order Status

- `DRAFT`
- `PENDING_PAYMENT`
- `PAYMENT_SUBMITTED`
- `PAID`
- `SENT_TO_INSURER`
- `INSURER_REVIEWING`
- `POLICY_APPROVED`
- `POLICY_ISSUED`
- `REJECTED`
- `CANCELLED`

### Payment Status

- `UNPAID`
- `AWAITING_TRANSFER`
- `SLIP_SUBMITTED`
- `VERIFYING`
- `PAID`
- `FAILED`
- `REFUNDED`

### Payment Method

- `BANK_TRANSFER`
- `CARD_GATEWAY`

## Proposed Database Shape

### Option A: Expand `Order` First

Best for quick progress. Add nullable fields to `Order`:

- Customer/policy fields:
  - `customerName`
  - `customerPhone`
  - `customerEmail`
  - `customerAddress`
  - `province`
  - `district`
  - `subDistrict`
  - `postalCode`
  - `idCardNumber`
  - `carBrand`
  - `carModel`
  - `carYear`
  - `plateProvince`
  - `policyStartDate`

- Payment fields:
  - `paymentMethod`
  - `paymentStatus`
  - `paymentAmount`
  - `slipUrl`
  - `gatewayUrl`
  - `paidAt`

- Insurer/magic-link fields:
  - `insurerStatus`
  - `insurerNote`
  - `insurerUpdatedAt`

Pros:
- Fastest path.
- Minimal model complexity.
- Easier to adapt current pages.

Cons:
- `Order` becomes large.
- Status history and multiple insurer updates need a second pass.

### Option B: Add Supporting Models Now

Better long-term design:

- `Order`
- `OrderStatusHistory`
- `Payment`
- `MagicLinkToken`

Pros:
- Clean separation.
- Better audit trail.
- Magic link flow is safer.

Cons:
- More migration and UI work upfront.

### Recommended Approach

Use a hybrid:

1. Expand `Order` with core policy and payment fields now.
2. Add `OrderStatusHistory` now, because tracking and insurer updates need auditability.
3. Add `MagicLinkToken` now, because token safety should not be improvised later.
4. Keep a separate `Payment` model optional for later unless multiple payments/refunds become necessary.

## Proposed New Models

### `OrderStatusHistory`

Purpose: show timeline in customer tracking and admin.

Fields:

- `id`
- `orderId`
- `status`
- `message`
- `actorType` (`CUSTOMER`, `ADMIN`, `INSURER`, `SYSTEM`)
- `actorName`
- `createdAt`

### `MagicLinkToken`

Purpose: let insurer update an order without admin login.

Fields:

- `id`
- `orderId`
- `tokenHash`
- `purpose`
- `expiresAt`
- `usedAt`
- `createdAt`
- `updatedAt`

Store only a hash of the token, not the raw token.

## First Implementation Milestone

Milestone 1 should avoid LINE API and real payment gateway integration. It should make the app flow complete with local UI and stored data.

Scope:

1. Add schema fields and models.
2. Upgrade `/line-app/form/[id]` into Policy Info.
3. Add `/line-app/checkout/[orderId]`.
4. Expand `/line-app/success/[orderId]`.
5. Add `/line-app/tracking/[orderNumber]`.
6. Expand `/admin` order table enough to view payment and policy details.

Out of scope for Milestone 1:

- Real LINE LIFF auth
- Real LINE push notification
- Real payment gateway callback
- Real email sending

## Implementation Order

1. Schema foundation
   - Update `prisma/schema.prisma`
   - Create migration
   - Regenerate Prisma client

2. Server actions
   - `createPolicyDraftOrder`
   - `submitBankTransferPayment`
   - `selectGatewayPayment`
   - `updateOrderStatusWithHistory`

3. Customer pages
   - Consent
   - Policy Info
   - Checkout
   - Success
   - Tracking

4. Admin dashboard update
   - Add payment method/status
   - Add policy/customer details
   - Add timeline/status history

5. Magic link foundation
   - Generate token
   - Add update page
   - Record insurer updates in status history

6. Integration polish
   - Email template
   - LINE notification preview
   - Real external integrations later

## Risks And Notes

- Thai text appears mojibake in several source files when read through PowerShell. Verify in browser/editor before editing large UI copy.
- The current `.env` was reset from `.env.example` once during setup. Keep real local values out of committed files.
- `prisma/` currently has no migrations directory, so the first migration should be created carefully against the existing database state.
- Uploaded slip/logo files should use separate directories: `public/uploads/slips` and `public/uploads/logos`.
- Magic link tokens must be random, time-limited, and stored hashed.
