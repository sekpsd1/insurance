# Insurance CSV Import Guide

Use this as the working reference for campaign package CSV imports.

## Required Campaign Inputs

These are entered in the admin import modal, not necessarily in the CSV:

- Company code
- Campaign code
- Campaign name
- CSV file
- Optional campaign logo

## Common Supported Columns

The importer accepts insurer campaign rows and maps the commonly used fields into searchable package data:

- `SClass` - vehicle class, such as `110`, `210`, `320`.
- `covcod` - coverage code. Customer-facing flow supports `2.2`, `3.2`, `3`, and `3.3`; first class codes are excluded from customer results.
- `MinSI` / `MaxSI` - sum insured range.
- `MinYear` / `MaxYear` - car age range, not registration year.
- `MinCST` / `MaxCST` - cubic capacity range.
- Brand/model fields from the CSV source are imported into package brand/model fields when present.
- Price fields are imported into full price, net price, and discount fields according to the existing importer mapping.

## Admin-Managed Fields

These are campaign-level settings and should normally be maintained in Admin after import:

- Provider name
- Provider contact name
- Provider email
- Provider phone
- Bank name
- Account name
- Account number
- Payment URL
- Payment notes
- Payment QR/image
- Campaign logo

## Validation Notes

- CSV files are limited to 15 MB.
- The upload must be a text CSV file and must not contain binary null bytes.
- Customer-facing search excludes first class insurance.
- Missing repair type is currently displayed as garage repair fallback text until the source data rule is confirmed.

## QA After Import

- Open `/line-app/search` and confirm vehicle class, coverage, brand, model, year, cubic capacity, and sum insured options appear.
- Search one known campaign row and confirm the result count is expected.
- Open Admin campaign details and fill provider contact plus payment setup before running a real checkout.
