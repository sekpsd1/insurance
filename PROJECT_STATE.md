# Project State

Last updated: 2026-06-08

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
- `/line-app/cart` - saved package cart for plans customers want to keep before choosing.
- `/line-app/form/[id]` - Policy Info page for the selected package.
- `/line-app/checkout/[orderId]` - hybrid checkout.
- `/line-app/success/[orderId]` - order success and recent timeline.
- `/line-app/tracking` - order tracking lookup.
- `/line-app/tracking/[orderNumber]` - order tracking detail.

The customer flow currently starts at `/line-app/search`. LINE rich menu and consent are treated as external LINE/LIFF responsibilities, not in-system pages.

#### Admin/Broker Flow

Admin routes live under `/admin`.

- `/admin/login` - cookie-based login using `ADMIN_PASSWORD`; optional sales access uses `SALES_USERNAME`/`SALES_PASSWORD`.
- `/admin/logout` - clears admin session cookies and redirects back to login.
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
- `repairType` from `GarageCd`, where `G`/`DG` means `ซ่อมห้าง` and blank/other values mean `ซ่อมอู่`.
- `minSumInsured` and `maxSumInsured` from `MinSI`/`MaxSI`.
- `minCarAge` and `maxCarAge` from `MinYear`/`MaxYear`.
- `minCubicCapacity` and `maxCubicCapacity` from `MinCST`/`MaxCST`.
- `payablePrice` from CSV `paid`, used as the customer remaining payable amount.

`Order` stores customer policy info, vehicle info, payment method/status, slip/gateway fields, insurer status/note, and links to status history and magic links.

`Order` also stores optional CTP/CMI add-on details when the customer adds compulsory insurance:

- `ctpSelected`
- `ctpRateCode`
- `ctpVehicleTypeCode`
- `ctpPremium`
- `ctpStamp`
- `ctpVat`
- `ctpTotal`

`CtpRate` stores editable CTP/CMI rates per vehicle class/SClass for customer add-ons.

`EmailOutbox` stores provider email audit records, including recipient, subject, body, Magic Link path, queue/error status, and sent/error timestamps.

`TypeOneQuoteLead` stores Type 1 quote requests for sales follow-up when customers need a manual quote instead of instant package search.

`SystemSetting` stores small editable operational settings such as the sales recipient email for Type 1 quote requests. The app reads this DB setting first and falls back to environment variables when unset.

## Completed Tasks

### Customer Flow

- Search Premium page loads real brand/model/year options from DB.
- Opening `/line-app` without search query parameters now redirects to `/line-app/search` so customers start from the vehicle search form instead of seeing the unfiltered package list.
- Search Premium now filters by insurer vehicle class (`SClass`) and selected sum insured (`MinSI`/`MaxSI`).
- Search Premium vehicle type options now show customer-facing groups:
  - `รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู` maps to `SClass 110`.
  - `รถกระบะ 2 ประตู` maps to `SClass 320`.
  - `รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า` maps to `SClass 210`.
- Search Premium now supports a repair coverage selector:
  - `ซ่อมห้าง` maps to CSV `GarageCd = G` or `DG`.
  - `ซ่อมอู่` maps to blank `GarageCd`.
- Search Premium now shows only the four customer-requested policy type groups:
  - `ประเภท 1`
  - `ประเภท 2 พลัส` from CSV `covcod` `2.1`/`2.2`
  - `ประเภท 3 พลัส` from CSV `covcod` `3.1`/`3.2`
  - `ประเภท 3` from CSV `covcod` `3`
- Search Premium option payload is grouped on the server and computes registration year options in the client from age ranges to avoid sending one option row per premium row.
- Search Premium now exposes cubic-capacity ranges from `MinCST`/`MaxCST` as a "ขนาดเครื่องยนต์" selector because no separate vehicle submodel master exists in the imported CSV.
- Search Premium treats `SClass 210` van/blue-plate rows as seat-count based because imported `MinCST`/`MaxCST` is `0-12`; customer-facing search/results/compare labels show `จำนวนที่นั่ง` / `ไม่เกิน 12 ที่นั่ง` while keeping the internal `cubicCapacity` query and `MinCST`/`MaxCST` filtering unchanged.
- Search Premium now uses type 3 vehicle option data as a fallback for policy type 2+ and 3+ brand/model dropdowns, while registration year, cubic capacity, and seat-count options prefer rows from the selected policy type and repair type when available before falling back to type 3 vehicle data. When 2+/3+ must fall back to type 3 vehicle data because the model does not exist in 2+/3+, the registration-year dropdown is capped to a maximum vehicle age of 30 years.
- Search Premium now normalizes brand/model option values case-insensitively before building dropdowns and result queries, so imported variants such as `City` and `CITY` are treated as the same Honda City model for year, engine, sum-insured, and campaign matching.
- Search year now maps registration year to insurance-style vehicle age using `current year - registration year + 1`, filters against CSV `MinYear`/`MaxYear`, and builds year dropdown options from the CSV age range using the same registration-year formula.
- Search Results filters by coverage, repair type, brand, model, and year.
- Search Results preserve and apply `sClass`, `repairType`, `cubicCapacity`, and `sumInsured` query parameters.
- Search Results now shows a `เปลี่ยนประเภท / ทุนประกัน / ซ่อมห้าง ซ่อมอู่` button in the search summary box that returns to `/line-app/search` with the current filters prefilled.
- Search Premium preserves vehicle selections when changing policy type or repair coverage, and only clears downstream vehicle fields when the old value is not available in the newly filtered data.
- Search Premium now derives repair coverage options from the selected vehicle class and policy type. If a new policy type only has one repair coverage, such as `ประเภท 3` with only `ซ่อมอู่`, the form auto-switches to that repair coverage and keeps the vehicle selections when still valid.
- Search Premium now supports packages with `MinSI`/`MaxSI` equal to `0`, such as some `ประเภท 3` rows, by showing `ไม่มีทุนประกัน` as a selectable sum-insured option.
- Search Premium now routes `ประเภท 1` to a quote request form instead of instant package search. It collects customer name, phone, LINE ID/LIFF profile when available, optional email, brand, model, registration year, and cubic capacity, stores a `TypeOneQuoteLead`, and queues an email to `SALES_LEAD_EMAIL` when configured. Because Type 1 packages are not sold from CSV results, the Type 1 form uses broader vehicle option data from the selected SClass so customers can still submit a lead, but its registration-year dropdown is capped to a maximum vehicle age of 30 years.
- Type 1 quote request now hides the editable LINE ID input when LIFF profile data is available, while still submitting the LINE user ID internally.
- Type 1 quote request email now reads the editable admin sales recipient first, then falls back to `SALES_LEAD_EMAIL`.
- Search Premium sum-insured options now respect the selected repair type so customers do not select a sum insured that only exists under a different repair group.
- Search Premium no longer shows the blue explanatory filter-info box above the submit button.
- Search Premium no longer restores saved vehicle/policy filters from localStorage, so a fresh visit to `/line-app/search` starts blank for customers searching another car. Search/result URLs with query parameters still prefill the current search when users navigate back from results. Type 1 lead contact inputs can still be preserved separately.
- Search Premium includes a `กลับเมนู LINE` action that closes the LIFF window when available, giving customers a clear way back to the LINE/Rich Menu context.
- LINE Mini App `liff.state` redirects now allow `/cart` as well as tracking/search paths, so a Rich Menu button can open the saved cart directly via the published Mini App URL.
- Results page supports pagination.
- Result cards encode uploaded logo URLs before rendering and fall back to company text if the image cannot be loaded.
- Result cards and compare table display repair type from `GarageCd` as `ซ่อมห้าง` or `ซ่อมอู่`.
- Compare selection flow exists.
- Compare page displays two selected packages side by side as a detailed coverage-comparison table, including third-party liability, own-damage/lost-fire coverage, attached-document benefits, premium, CTP, total, and remaining payable rows; the ready table uses section icons, colored plan columns, highlighted totals, and a more prominent remaining-payable row while keeping remove/cart actions in the plan headers. The coverage-label column scrolls normally on mobile instead of staying sticky.
- Results and compare preserve query parameters.
- Results page now hides the extra result-summary/count blocks above the plan list and shows the plan cards before the quick-filter card so customers reach the payable section sooner while keeping the remaining payable box in its original position inside each plan card.
- Results page now uses a compact blue header without the unused menu button and tighter top/card spacing so customers can see the remaining payable section sooner in LINE Mini App.
- Results plan cards now use tighter padding, smaller detail icons, compact full-width vehicle-title text, and append registration year to the vehicle title to preserve space so more of the selected plan card is visible in the first mobile viewport.
- Cart plan cards now match the compact results-card layout more closely, including the full-width brand/model/year title, smaller icons, tighter spacing, compact cost summary, and compact remaining-payable section. The cart header only shows the number of saved plans and no longer shows a combined remaining-payable total. Opening `/line-app/cart` without query IDs now reads saved cart IDs from localStorage and redirects to the populated cart URL, so Rich Menu cart links can show the customer's saved plans.
- Customer-facing zero sum-insured display text now says `ไม่คุ้มครอง` instead of `ไม่มีทุนประกัน` across search, results, cart, and compare views.
- Search Premium no longer shows or requires the sum-insured selector for policy type 3; customers can search type 3 packages after choosing vehicle, repair, year, and engine details.
- Search Premium now opens the `ไม่มีแคมเปญสำหรับรุ่นนี้ สามารถเลือกแผนอื่นได้` popup when policy type 2+, 3+, or 3 has no premium/campaign for the selected vehicle details.
- Search Premium now shows a blocking loading popup while searching packages or submitting a Type 1 quote request, so customers see progress and cannot tap submit repeatedly during slow result loads.
- Compare table now labels the package premium row as `เบี้ยประกัน` instead of `เบี้ยประกันราคาทุน`.
- Results and cart plan cards now split the combined `ดูรายละเอียด / เลือกแผนนี้` action into separate `ดูรายละเอียด` and `เลือกแผนนี้` buttons.
- Type 3 plan details now show `รถสูญหาย/ไฟไหม้` and `ความเสียหายต่อตัวรถ` as `ไม่คุ้มครอง`.
- Type 2+ plan details now show `รถสูญหาย/ไฟไหม้` and `ความเสียหายต่อตัวรถ` as the selected sum insured amount.
- Plan detail expansion now normalizes coverage labels/codes before applying coverage-specific detail rules and no longer exposes raw imported package `details` strings to customers.
- Results plan cards no longer pass imported package `details` into the client payload, preventing raw importer strings such as `brand=... | model=...` from appearing in the detail expansion or page hydration data.
- Results plan detail expansion now follows the uploaded coverage-detail Excel template and reads CSV/rawData columns such as `uom1_v`, `uom2_v`, `uom5_v`, `MinSI`, `Dedod`, `Seats41`, `mv411`, `mv412`, `mv42`, and `mv43` instead of showing only the two temporary own-damage rows.
- Results plan detail expansion now places own-damage coverage and its first-deductible row before lost/fire coverage, labels own damage as `3.1`, labels lost/fire as `3.2`, and type 3 uses the shorter `3.1 ความคุ้มครองความเสียหายต่อรถยนต์` label without the land-vehicle collision wording.
- Cart plan cards now open the same coverage-detail expansion inline from the `ดูรายละเอียด` action instead of sending customers to the Policy Info form.
- Results and cart plan cards now hide cubic capacity from the vehicle detail card while keeping registration year visible; cubic capacity remains part of the search/filter query.
- Results now normalizes stale or invalid sum-insured query values for the selected policy type and repair type before rendering, preventing mismatched URLs such as dealer coverage with an unavailable 50,000 baht sum insured from showing an error/no-result state.
- Results, compare, search, and Policy Info back navigation now preserve search query parameters so users return to the same filtered result/search state instead of the unfiltered package list.
- Policy Info page has been redesigned to match the Stitch-style form:
  - Personal information card.
  - Vehicle information card.
  - Name, phone, delivery address, plate number, plate province.
- Policy Info page UI was refined for a cleaner mobile form:
  - Shorter header and tighter section cards.
  - Compact white input/select fields with lighter borders.
  - Smaller textarea and label spacing.
  - Sticky bottom submit action bar.
- Policy Info page no longer shows a standalone CTP/CMI add-on banner; selected CTP/CMI is still carried through hidden form state and included in the checkout/order total.
- Policy Info page autosaves customer/contact/address/plate fields to localStorage and restores them on the same device if the LINE Mini App is closed before submission; the draft is cleared after a valid submit.
- Customer results now support an optional CTP/CMI add-on checkbox for eligible vehicle classes:
  - `SClass 110` sells CTP rate `1.10` at total `645.21`.
  - `SClass 320` sells CTP rate `1.40A` at total `967.28`.
  - Other vehicle classes cannot select the CTP add-on.
- Admin insurance dashboard now includes editable CTP/CMI rate settings for SClass `110`, `210`, and `320`; `210` is present but defaults to not sellable until a price is configured and enabled.
- Admin CTP/CMI settings now clarify that `Total` is the customer payable price while `Rate Code` is only a reference code; money fields accept comma-formatted decimal text such as `1,182.35` and are easier to read.
- Selected CTP/CMI add-ons are carried into Policy Info, stored on `Order`, and included in `paymentAmount`.
- Checkout page supports:
  - Bank transfer with slip upload.
  - Gateway mock link flow.
- Checkout payment summary now keeps a single `คงเหลือชำระ` row with the actual transfer amount, while hiding the extra itemized premium/CTP breakdown rows to reduce customer confusion.
- Checkout, success, tracking, admin order detail, provider Magic Link, provider email preview, and provider email body now show selected CTP/CMI details when present.
- Customer tracking detail now shows the payment breakdown for the main plan remaining payable amount, selected CTP/CMI amount, and combined amount due instead of showing only the CTP/CMI line.
- Provider Magic Link emails sent through Resend now include an HTML `Update policy status` button while preserving the plain-text fallback link.
- Provider Magic Links now remain usable after `POLICY_APPROVED` so insurers can continue the same link to `POLICY_ISSUED`; links are closed only after `POLICY_ISSUED` or `REJECTED`.
- Success page shows order summary, payment method, and timeline.
- Tracking page supports lookup and direct tracking by order number.
- Tracking page now uses LIFF profile data and same-device remembered order numbers to show the current customer's recent orders automatically, while keeping manual order-number lookup as a fallback for non-LINE sessions or older orders without a linked LINE profile.
- Customer-facing selection/results/compare now use the four customer-requested policy type groups instead of exposing detailed DD/OD `covcod` labels.

### Admin/Broker Flow

- Admin login exists with cookie-based auth. Admin access still works with `ADMIN_PASSWORD`; optional `SALES_USERNAME`/`SALES_PASSWORD` creates a limited sales role that sees only Orders navigation, while middleware blocks Type 1 Leads, campaign/package/readiness routes, and provider email-preview routes. Admin header includes a logout action that clears `admin_token` and `admin_role`.
- Admin order page has been shifted toward monitor/report behavior. The order list now shows payment amounts with two decimal places and keeps the provider email/Magic Link preview out of the main list actions; admins can still access Magic Link tools from the order detail page.
- Campaign dashboard supports CSV import.
- Campaign-level logo upload exists.
- Package management page exists for package search/edit.
- Admin now has `/admin/leads` for Type 1 quote requests, including search, email-status filtering, customer/vehicle details, and resend email action.
- Admin Type 1 Leads now supports sales follow-up status and internal notes, so sales can track whether a Type 1 quote request is new, contacted, quoted, or closed.
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
- Checkout now attempts to send the provider email automatically after creating the `EmailOutbox` row.
- Admin Email Outbox send button is now primarily for retry/manual recovery rather than the normal checkout path.
- Provider email delivery can now use Resend when `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL` are configured. Local development still supports mock email logging; production fails visibly if email delivery is not configured.
- Admin insurance dashboard includes an editable sales lead email setting for Type 1 quote requests, so operators can change the recipient without editing Plesk environment variables or restarting the app.
- Real LINE notifications are intentionally deferred for a later implementation slice.

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
- Deleting or replacing a campaign now removes dependent order records for packages in that campaign before deleting the package rows, so old import campaigns can be cleared after taking a database backup.
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
- Uploads now validate image MIME/content signatures, size limits, and sanitized filenames. Upload storage supports local files for development and S3-compatible object storage through `UPLOAD_STORAGE_DRIVER=s3`; production local uploads are blocked unless `ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true` is explicitly set.
- Server-side form validation now covers customer phones/emails, Thai ID checksum, plate number, policy date range, provider contact fields, payment setup fields, admin status values, insurer notes, and CSV upload shape.
- Customer, admin, and provider error pages now show friendlier Thai validation/recovery messages for common server-action failures.
- Invalid or expired provider Magic Links now render a provider-facing explanation page instead of a generic 404.
- Admin sessions now use signed, expiring cookie values instead of a static cookie marker.
- Provider Magic Links are marked used after terminal provider statuses and the provider page blocks further updates with a used terminal token.
- `/api/health` exists as a production smoke-test endpoint that checks database connectivity.
- `/admin/readiness` shows production readiness checks for DB, app URL, admin session env, provider email, and upload storage.
- `server.js`, `npm run smoke`, `DEPLOYMENT_CHECKLIST.md`, and `PLESK_DEPLOYMENT.md` document and support Plesk Node.js deployment.
- `CSV_IMPORT_GUIDE.md` documents supported import columns, `prm_gapnew`/`paid` price mapping, and post-import QA.
- Latest pushed commits:
  - `a4ccef4` - order checkout and Magic Link flow.
  - `502e6af` - removed first class insurance from customer flow.

## Pending Tasks

### Email / Notification

- Configure production email env and verify provider email delivery end to end.
- Replace simulated broker email log with a real notification.
- Replace simulated LINE push log with real LINE Messaging API integration.

### Payment

- Keep customer slip upload for bank transfer; provider should be able to inspect it from Magic Link.

### Magic Link

- Consider token rotation for non-terminal provider updates if insurers need multiple independent update links.
- Add stronger provider identity fields on update.
- Add provider-facing attachment/download views if insurer needs documents/slip.
- Improve expired/invalid Magic Link error page.

### Admin

- Consider separating campaign/package management from order monitoring in navigation labels.
- Consider richer report views or scheduled exports if CSV downloads are not enough for operations.

### Data / Imports

- Keep `CSV_IMPORT_GUIDE.md` updated as new importer mappings are added.
- Consider provider contact import fields if CSV sources include them.

## Current Bugs / Known Issues

- Thai text appears mojibake in some files when read through PowerShell. Browser rendering may still be fine, but large Thai copy edits should be checked visually.
- Imported CSV/database rows may not store a direct `year`; compare now falls back to the searched registration year.
- Uploaded slip/logo/payment QR files can use S3-compatible object storage in production. Existing local files under `public/uploads` remain local/dev files unless migrated.
- `tsconfig.tsbuildinfo` may show as modified after typecheck/build. It is generated and should not be committed.
- Build still shows Next lint warnings for `<img>` usage in compare pages and checkout QR/payment images.
- Running `npm run build` and then dev mode can leave stale `.next` chunks on Windows; clearing `.next` and restarting dev fixes it.
- Local database schema was synced with `npx prisma db push` after adding `EmailOutbox`; future environments need the same schema push or a proper migration.
- Local database schema was synced again with `npx prisma db push` after adding `InsurancePackage` rating/search fields for SClass, sum insured, car age, and cubic capacity.
- Local database schema was synced again with `npx prisma db push` after adding optional CTP/CMI fields to `Order`.

## Latest Local Verification

Last verified on 2026-05-26 after adding Import QA and cleaning old sample package rows.

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Build still shows the known acceptable `<img>` warnings in checkout/compare areas.
- `/api/health` returned 200.
- `/line-app/cart` returned 200.
- Browser QA confirmed `เก็บใส่ตะกร้า` shows a separate `ดูรายการในตะกร้า` sticky action and opens `/line-app/cart` with the saved package ID.
- Local dev server was restarted after clearing stale `.next` chunks; `/api/health`, `/line-app/cart`, and the tested results URL returned 200.
- `/line-app` without query parameters redirects to `/line-app/search`.
- `/line-app` returned 200 for a results URL using `SClass 110`, grouped `2+`, `ซ่อมอู่`, `TOYOTA HILUX REVO`, registration year `2022`, cubic capacity `2001`, and sum insured `300000`.
- `/line-app` returned 200 for `ประเภท 3` / `ซ่อมอู่` / `sumInsured=0`.
- Results now let customers switch policy type, repair coverage, and sum insured directly on the results page while preserving the selected vehicle details in the query string.
- Results proposal cards now show a separate plan detail box and cost summary box, and use `covcod` to show whether first deductible applies.
- CSV import now maps `prm_gapnew` to package premium (`netPrice`) and `paid` to `payablePrice`.
- Local package rows were backfilled again on 2026-05-26 so `netPrice` exactly matches `rawData.prm_gapnew`; 16,328 rows were updated after customer confirmation that the displayed premium must come from `prm_gapnew`.
- Admin insurance dashboard now includes an Import QA card that checks campaign import rows only and verifies whether `InsurancePackage.netPrice` matches `rawData.prm_gapnew`, shows mismatch counts, and lists up to 10 example rows for follow-up after CSV import.
- The two old manual/sample packages named `ประกันชั้น 1 พลัส` for `กรุงเทพ` and `วิริยะประกันภัย` were deleted from the local database because they were not real campaign import data and did not have `rawData.prm_gapnew`.
- Current local Import QA after deleting those sample rows: 41,015 campaign import rows, 41,015 rows with `prm_gapnew`, 41,015 matching rows, 0 mismatches, and 0 missing `prm_gapnew` rows.
- CSV import field lookup now respects alias priority instead of CSV column order, so `prm_gapnew` is used for `netPrice` even when older premium columns such as `prem_net_pd` appear earlier in the uploaded CSV.
- Admin Delete Campaign now requires a browser confirmation before submitting the destructive server action.
- Compare page header now sits above sticky comparison-table cells while scrolling, preventing the left detail column from overlapping the blue top bar.
- Cart package cards now use the same proposal-style detail and cost-summary layout as the customer results cards, including icons, deductible wording, CTP, total, and remaining-payable sections.
- Results, cart, compare, checkout, and order creation now use `payablePrice + CTP/CMI` as the customer payable amount, while still showing the package premium separately.
- Cart links now carry selected CTP/CMI package IDs through `ctpIds`; the cart page shows the optional CTP/CMI line, includes it in remaining payable totals, and keeps `includeCtp=1` when customers continue to Policy Info from the cart.
- Compare links now also carry selected CTP/CMI package IDs through `ctpIds`; the comparison table shows CTP/CMI, total premium, and remaining payable per compared plan.
- Returning from the comparison page to results preserves selected CTP/CMI checkboxes through the `ctpIds` query and separate compare CTP localStorage, so comparison selections no longer get overwritten by cart-only CTP state.
- Customer-facing result, cart, and comparison cards now hide internal package/campaign names such as `Sabai ...`; customer views keep insurer, vehicle, coverage, repair, sum insured, and pricing details visible.
- Customer-facing result and cart cards now show vehicle brand/model from structured package fields after hiding internal package names, so entries still display values such as `TOYOTA · HILUX REVO` without exposing campaign names. The comparison table keeps brand/model only in its dedicated table rows.
- Existing imported package rows were backfilled from `rawData.paid` into `payablePrice` after the schema update.

Last verified on 2026-05-21 using localhost dev server after the customer search/results/compare refinement slice.

- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Build still shows the known acceptable `<img>` warnings in checkout/compare areas.
- `/api/health` returned 200 with database `ok`.
- `/line-app/search` returned 200 with the updated vehicle type, grouped policy type, repair coverage, cubic capacity, and sum insured flow.
- `/line-app` results returned 200 for `ประเภท 3` / `ซ่อมอู่` / `sumInsured=0` and displays `ไม่มีทุนประกัน`.
- Search now auto-switches repair coverage when the chosen policy type has only one valid repair option, for example `ประเภท 3` automatically switches to `ซ่อมอู่`.
- Search keeps vehicle selections when changing policy type or repair coverage if the vehicle values still exist in the newly filtered data.
- Results now show vehicle type, registration year, and cubic capacity in package cards.
- Results package cards were reorganized into a customer-facing proposal layout with a plan detail box and cost summary box, including deductible wording derived from `covcod` (`2.2`/`3.2` show no first deductible; `2.1`/`3.1` show first deductible applies).
- Results now include `เปลี่ยนประเภท / ทุนประกัน / ซ่อมห้าง ซ่อมอู่`, returning to search with current filters prefilled.
- Results now include an in-page quick filter panel for policy type, repair coverage, and sum insured so customers can adjust those choices without returning to the full vehicle search form.
- Results separate compare selection from cart selection:
  - `เลือกเทียบ` stores compare selections.
  - `เก็บใส่ตะกร้า` stores cart selections separately.
- Results now show a separate sticky cart bar after customers save packages, with a `ดูรายการในตะกร้า` action that opens `/line-app/cart`.
- `/line-app/cart` now displays saved packages, total premium, remove-per-plan, clear-cart, back-to-results, and choose-plan actions.
- Home page Customer CTA now links directly to `/line-app/search`.
- Compare page title is now Thai: `ตารางเปรียบเทียบแผน`.
- Compare page supports removing individual compared plans and has a separate `เก็บใส่ตะกร้า` button per plan.
- Compare page no longer shows the rows for general market price, coverage, or discount, per the latest comparison-table cleanup.

- Search page vehicle info intro heading is tightened for mobile so `??????????????????` stays on one line.
- Results package card headers now let insurer/vehicle text use the available right-side space under the compare button on mobile.
- Root `/` page no longer shows the internal project intro/stack copy; it only keeps quick links to Customer and Admin.
- Search Premium vehicle selectors no longer hide older registration years just because `ซ่อมห้าง` is selected; the form can use the broader vehicle option data for year/engine/sum-insured selection, then alerts `ไม่มีแคมเปญสำหรับรถรุ่นดังกล่าว` if the selected repair type has no exact campaign.
- The no-campaign search feedback now uses an in-app modal instead of the browser alert, with a clear `ปรับเงื่อนไขใหม่` action.
- Customer Policy Info form now initializes LINE MINI App / LIFF profile data when `NEXT_PUBLIC_LIFF_ID` is configured, storing LINE user ID, display name, and picture URL on `User`; the form also includes an optional customer email field.
- Policy Info no longer loads the LIFF SDK on the customer form page to avoid LINE redirect loops during production testing; if no LINE profile is submitted, order creation falls back to an internal `guest:` user key so customers can continue filling the form.
- Compare table no longer shows the top-left detail label or the bottom package details row, keeping only the useful comparison rows.
- Customer `/line-app` layout no longer shows the internal `Customer Area / LINE Mini App Insurance Quote` header so production customer pages start directly with the app screen header.
- Cart and results card sum-insured display now normalizes min/max values before comparison so equal imported values such as `50000` and `50000` render as one amount instead of a duplicated range.

Last verified on 2026-05-17 using localhost production start.

- After the Policy Info UI refinement and CTP/CMI add-on slice:
  - `npx tsc --noEmit` passed.
  - `npx prisma validate` passed.
  - `npx prisma db push` synced the local MySQL schema.
  - `npm run build` passed.
  - Build still shows the known acceptable `<img>` warnings in checkout/compare areas.

- `npm run smoke` passed:
  - `/api/health` returned 200 with database `ok`.
  - `/line-app/search` returned 200.
  - `/admin` redirected to `/admin/login` with 307 as expected.
- Browser flow passed:
  - Search selected `110`, `2+`, `BYD`, `SEALION 6`, `2023`, `2000`, and `250000`.
  - Results showed the filtered package and back navigation preserved all query values in `/line-app/search`.
  - Policy Info form created a test order.
  - Checkout via provider gateway reached success page.
  - Provider Magic Link opened from `EmailOutbox.magicLinkPath`.
  - Provider terminal update to `POLICY_ISSUED` wrote timeline history and marked the Magic Link as used.
  - Reopened provider page showed the used-link blocked state instead of the update form.
  - Customer tracking showed `ออกกรมธรรม์แล้ว`.
- During browser QA, the one-result page sticky compare bar was found to obscure the package card on desktop. It was fixed by showing the sticky compare bar only when at least two packages are available.
- Local test order created during QA: `IN-20260517-442935`.
- Local production server was restarted after QA and `/admin` was confirmed reachable again.

## Important Decisions

- LINE rich menu and consent are outside this web app scope for now.
- Customer web flow starts at `/line-app/search`.
- Admin/broker should primarily manage insurance data and monitor orders, not manually drive policy status.
- Insurance provider Magic Link is the main mechanism for provider-side status updates.
- Magic Link raw tokens are not stored; only token hashes are stored.
- Customer-facing insurance type filtering follows the four customer-requested groups, including `ประเภท 1` when imported data is available.
- Campaign logos are managed at campaign level, not per-package.
- Provider Contact is stored on `InsurancePackage` rows and updated across packages in the same campaign.
- Payment is made directly to the insurance company, not to this broker app.
- Bank transfer uses the insurance company's bank account details.
- Online/gateway payment links out to the insurance company's own payment URL.
- Payment instructions should be stored and managed at campaign level.
- Insurance provider staff review uploaded bank transfer slips from the Magic Link page and decide policy status there.
- Resend-backed provider email is implemented but must be configured in production env; real LINE integration is intentionally not implemented yet.

## Next Recommended Steps

1. Deploy to the production host and run production QA.
   - Configure Plesk Node.js with `server.js` as the startup file and `public` as document root.
   - Set production env values for DB, admin session, app base URL, Resend email, and S3/R2 uploads.
   - Apply the production database schema through the approved migration or schema push workflow.
   - Open `/admin/readiness`, verify `/api/health`, run `npm run smoke`, and complete one full customer checkout/provider Magic Link/tracking flow on the real domain.

2. Configure and verify production email delivery.
   - Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL`.
   - Send a real checkout/order email and confirm `EmailOutbox` status transitions to `SENT`.

3. Implement LINE notification integration.
   - Start with message templates.
   - Then add real LINE Messaging API push using customer `lineId`.
   - This is intentionally deferred until after the current admin/data cleanup work.

4. Improve admin order monitor.
   - Consider export/report views for filtered results.

5. Commit/push after each coherent slice.
