# Project State

Last updated: 2026-05-14

## Current Architecture

This project is a Next.js 15 App Router application for a car insurance LINE Mini App style purchase flow and broker/admin operations.

### Main Stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- MySQL
- Server Actions for writes

### Main Areas

#### Customer Flow

Customer-facing routes live under `/line-app`.

- `/line-app/search` - search premium form.
- `/line-app` - search results and package cards.
- `/line-app/compare` - comparison table and compare selection flow.
- `/line-app/form/[id]` - Policy Info page for the selected package.
- `/line-app/checkout/[orderId]` - hybrid checkout.
- `/line-app/success/[orderId]` - order success and recent timeline.
- `/line-app/tracking` - order tracking lookup.
- `/line-app/tracking/[orderNumber]` - order tracking detail.

The customer flow currently starts at `/line-app/search`. LINE rich menu and consent are treated as external LINE/LIFF responsibilities, not in-system pages.

#### Admin/Broker Flow

Admin routes live under `/admin`.

- `/admin/login` - simple password login using `ADMIN_PASSWORD`.
- `/admin` - order monitor/report page.
- `/admin/orders/[orderId]` - admin order detail page with customer, vehicle, payment, provider, email, and internal timeline detail.
- `/admin/insurance` - campaign dashboard, CSV import, logo upload, provider contact setup.
- `/admin/insurance/packages` - package search/edit page.
- `/admin/orders/[orderId]/email-preview` - Magic Link provider email preview.

Admin is intended to manage package/campaign data and monitor orders. The primary policy/order status updates should come from insurance provider Magic Links.

#### Insurance Provider Magic Link Flow

- `/insurance/update/[token]` - public Magic Link page for insurance company staff.

Magic Link tokens are stored as SHA-256 hashes in `MagicLinkToken`. The raw token is shown only in generated/preview links.

### Database Models

Main Prisma models:

- `User`
- `InsurancePackage`
- `Order`
- `OrderStatusHistory`
- `MagicLinkToken`
- `EmailOutbox`

`InsurancePackage` stores campaign/package data and now includes provider contact fields:

- `providerName`
- `providerEmail`
- `providerContactName`
- `providerPhone`

It also stores rating/search fields imported from insurer CSV rows:

- `sClass` from `SClass` vehicle class.
- `minSumInsured` and `maxSumInsured` from `MinSI`/`MaxSI`.
- `minCarAge` and `maxCarAge` from `MinYear`/`MaxYear`.
- `minCubicCapacity` and `maxCubicCapacity` from `MinCST`/`MaxCST`.

`Order` stores customer policy info, vehicle info, payment method/status, slip/gateway fields, insurer status/note, and links to status history and magic links.

`EmailOutbox` stores provider email audit records, including recipient, subject, body, Magic Link path, queue/error status, and sent/error timestamps.

## Completed Tasks

### Customer Flow

- Search Premium page loads real brand/model/year options from DB.
- Search Premium now filters by insurer vehicle class (`SClass`) and selected sum insured (`MinSI`/`MaxSI`).
- Search Premium now exposes cubic-capacity ranges from `MinCST`/`MaxCST` as a "ขนาดเครื่องยนต์" selector because no separate vehicle submodel master exists in the imported CSV.
- Search year now maps registration year to vehicle age and filters against CSV `MinYear`/`MaxYear`.
- Search Results filters by coverage, brand, model, and year.
- Search Results preserve and apply `sClass`, `cubicCapacity`, and `sumInsured` query parameters.
- Results page supports pagination.
- Compare selection flow exists.
- Compare page displays selected packages side by side.
- Results and compare preserve query parameters.
- Policy Info page has been redesigned to match the Stitch-style form:
  - Personal information card.
  - Vehicle information card.
  - Name, phone, delivery address, plate number, plate province.
- Checkout page supports:
  - Bank transfer with slip upload.
  - Gateway mock link flow.
- Success page shows order summary, payment method, and timeline.
- Tracking page supports lookup and direct tracking by order number.
- First class insurance has been removed from customer-facing selection/results/compare flow.

### Admin/Broker Flow

- Admin login exists with cookie-based auth.
- Admin order page has been shifted toward monitor/report behavior.
- Campaign dashboard supports CSV import.
- Campaign-level logo upload exists.
- Package management page exists for package search/edit.
- Provider Contact can now be saved per campaign and applied to all packages in that campaign.
- Email preview page exists for provider Magic Link emails.

### Magic Link Flow

- Magic Link token model exists.
- Magic Link token generation exists.
- Provider update page exists at `/insurance/update/[token]`.
- Provider update page shows full order detail before status update:
  - customer contact and address
  - ID card number when present
  - vehicle and plate
  - selected package, repair type, coverage, amount
  - payment method/status
  - payment slip or gateway link when present
- Provider can update status:
  - `INSURER_REVIEWING`
  - `POLICY_APPROVED`
  - `POLICY_ISSUED`
  - `REJECTED`
- Provider updates write to `OrderStatusHistory`.
- Provider update logs simulated broker email and simulated LINE push notification.

### Email / Notification

- Email Outbox model exists.
- Checkout now creates a provider Magic Link and writes a provider email audit row to `EmailOutbox`.
- Provider email preview generation also writes an `EmailOutbox` audit row.
- Missing provider email is captured as `MISSING_RECIPIENT` with an error message instead of only being hidden in server logs.
- Admin order monitor shows latest provider email status per order.
- Admin order monitor shows a recent Email Outbox table.
- Admin order monitor supports search/filter by order/customer/phone/plate, status, provider, payment method, date range, and missing provider email.
- Admin order monitor now links to a full order detail page for each order.
- Admin order monitor paginates the order table at 20 orders per page while preserving active filters.
- Admin order monitor can export the currently filtered order list as CSV from `/admin/orders/export`.
- Admin order detail page shows order progress, customer/vehicle details, package/payment details, slip/gateway links, provider contact, email outbox records, and full internal timeline.
- Admin can send queued provider emails with a mock sender from the Email Outbox table.
- Admin can retry `ERROR` email outbox rows.
- `SENT` rows show sent timestamp and cannot be resent from the monitor.
- `MISSING_RECIPIENT` rows are blocked until provider email is added to the campaign/provider contact.
- Admin-facing order, payment, and email statuses now display Thai labels while keeping internal enum/status values unchanged.
- Provider email preview and generated email body now display Thai payment method/status labels.
- Timeline/status history messages now render Thai labels for older English audit messages.
- New order/status/email history messages are recorded in Thai.
- Provider email outbox creation now reuses or refreshes the latest outbox row for an order instead of creating duplicate visible queue rows.
- Admin Email Outbox table shows the latest outbox row per order to avoid duplicate rows for the same order number.
- Admin Email Outbox table paginates at 20 latest rows per page.
- Checkout now attempts to send the provider email automatically after creating the `EmailOutbox` row, using the current mock sender.
- Admin Email Outbox send button is now primarily for retry/manual recovery rather than the normal checkout path.
- Real email delivery and real LINE notifications are intentionally deferred for a later implementation slice.

### Payment Flow Decision

- This system should not receive or hold customer payment directly.
- For bank transfer, customers should transfer directly to the insurance company's bank account.
- For online/card/gateway payment, the app should link out to the insurance company's own payment gateway/payment URL.
- Payment instructions should be managed at campaign level, similar to provider contact and campaign logo.
- Campaign payment setup should support:
  - bank name
  - account name
  - account number
  - QR code or payment image, if available
  - provider payment URL, if available
  - payment notes/instructions
- Campaign dashboard now supports saving bank details, QR/payment image, provider payment URL, and payment notes across all packages in the campaign.
- Campaign dashboard supports viewing/deleting the current campaign logo and payment QR/image.
- Replacing a campaign logo or payment QR/image now removes the previous uploaded file from local storage.
- Deleting a campaign now also removes its campaign logo and payment QR/image files from local storage.
- Checkout now displays the selected campaign/company payment instructions instead of the old demo broker bank account.
- Checkout gateway flow now uses the configured campaign/provider payment URL and no longer creates the mock `example.com` gateway URL.
- Uploaded customer slips should be visible to the insurance provider on the Magic Link page.
- Insurance provider staff are responsible for reviewing bank transfer slips from the Magic Link page and deciding the policy status themselves.
- Broker/admin does not need a separate slip approval gate before provider review; admin monitors orders and can inspect slips for support/reporting.
- A central in-app payment gateway/webhook is not planned unless a future business requirement changes this decision.

### Infrastructure / Maintenance

- `PROJECT_HANDOVER.md` exists.
- `IMPLEMENTATION_BLUEPRINT.md` exists.
- `PROJECT_STATE.md` added.
- `PROJECT_SUMMARY.md` added as a human-friendly summary.
- `AGENTS.md` was shortened so future agents read only `PROJECT_STATE.md` by default; `PROJECT_HANDOVER.md` and `IMPLEMENTATION_BLUEPRINT.md` are now archive/reference docs.
- ESLint config was updated for ESLint 9 flat config compatibility.
- `.gitignore` excludes local caches and uploaded slip files.
- `.gitignore` excludes local uploaded logo, payment QR/image, and slip files.
- Latest pushed commits:
  - `a4ccef4` - order checkout and Magic Link flow.
  - `502e6af` - removed first class insurance from customer flow.

## Pending Tasks

### Email / Notification

- Replace mock provider email sender with real email sending to `providerEmail`.
- Replace simulated broker email log with a real notification.
- Replace simulated LINE push log with real LINE Messaging API integration.

### Payment

- Keep customer slip upload for bank transfer; provider should be able to inspect it from Magic Link.

### Magic Link

- Add token invalidation/rotation behavior after provider action, if needed.
- Add stronger provider identity fields on update.
- Add provider-facing attachment/download views if insurer needs documents/slip.
- Improve expired/invalid Magic Link error page.

### Admin

- Consider separating campaign/package management from order monitoring in navigation labels.
- Consider richer report views or scheduled exports if CSV downloads are not enough for operations.

### Data / Imports

- Document supported CSV columns more explicitly.
- Consider provider contact import fields if CSV sources include them.

## Current Bugs / Known Issues

- Thai text appears mojibake in some files when read through PowerShell. Browser rendering may still be fine, but large Thai copy edits should be checked visually.
- Compare year can show `-` if imported CSV/database rows have no `year`.
- Uploaded slip/logo/payment QR files are local filesystem files under `public/uploads`; this is fine for local/dev but needs a production storage decision.
- `tsconfig.tsbuildinfo` may show as modified after typecheck/build. It is generated and should not be committed.
- Build still shows Next lint warnings for `<img>` usage in compare pages and checkout QR/payment images.
- Running `npm run build` and then dev mode can leave stale `.next` chunks on Windows; clearing `.next` and restarting dev fixes it.
- Local database schema was synced with `npx prisma db push` after adding `EmailOutbox`; future environments need the same schema push or a proper migration.
- Local database schema was synced again with `npx prisma db push` after adding `InsurancePackage` rating/search fields for SClass, sum insured, car age, and cubic capacity.

## Important Decisions

- LINE rich menu and consent are outside this web app scope for now.
- Customer web flow starts at `/line-app/search`.
- Admin/broker should primarily manage insurance data and monitor orders, not manually drive policy status.
- Insurance provider Magic Link is the main mechanism for provider-side status updates.
- Magic Link raw tokens are not stored; only token hashes are stored.
- First class insurance is removed from customer-facing flow.
- Campaign logos are managed at campaign level, not per-package.
- Provider Contact is stored on `InsurancePackage` rows and updated across packages in the same campaign.
- Payment is made directly to the insurance company, not to this broker app.
- Bank transfer uses the insurance company's bank account details.
- Online/gateway payment links out to the insurance company's own payment URL.
- Payment instructions should be stored and managed at campaign level.
- Insurance provider staff review uploaded bank transfer slips from the Magic Link page and decide policy status there.
- Real email and LINE integrations are intentionally not implemented yet; logs/preview pages are used for local MVP testing.

## Next Recommended Steps

1. Connect a real email provider.
   - Possible providers: SMTP, Resend, SendGrid, Amazon SES.
   - Replace `sendProviderEmailMock` while keeping Email Outbox audit updates.
   - This is intentionally deferred until after the current admin/data cleanup work.

2. Implement LINE notification integration.
   - Start with message templates.
   - Then add real LINE Messaging API push using customer `lineId`.
   - This is intentionally deferred until after the current admin/data cleanup work.

3. Improve admin order monitor.
   - Consider export/report views for filtered results.

4. Commit/push after each coherent slice.
