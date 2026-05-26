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
- `covcod` - coverage code. Customer-facing flow groups imported codes into four options: `ประเภท 1`, `ประเภท 2 พลัส`, `ประเภท 3 พลัส`, and `ประเภท 3`.
- `GarageCd` - repair type. `G` maps to `ซ่อมห้าง`; blank values map to `ซ่อมอู่`.
- `MinSI` / `MaxSI` - sum insured range.
- `MinYear` / `MaxYear` - car age range, not registration year.
- `MinCST` / `MaxCST` - cubic capacity range.
- Brand/model fields from the CSV source are imported into package brand/model fields when present.
- `prm_gapnew` - package premium shown to customers as `เบี้ยประกัน`; this must match `InsurancePackage.netPrice`.
- `paid` - remaining payable amount shown to customers as `คงเหลือชำระ`; this maps to `InsurancePackage.payablePrice`.
- Other legacy price fields may still be read as fallbacks, but customer-facing premium QA expects `prm_gapnew`.

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
- Customer-facing search groups `covcod` choices:
  - `1` / first-class prefixed values = `ประเภท 1`
  - `2.1` and `2.2` = `ประเภท 2 พลัส`
  - `3.1` and `3.2` = `ประเภท 3 พลัส`
  - `3` = `ประเภท 3`
- Customer-facing vehicle type options map to insurer vehicle classes: `110` for `รถยนต์นั่ง ส่วนบุคคล / รถกระบะ 4 ประตู`, `320` for `รถกระบะ 2 ประตู`, and `210` for `รถตู้ / กระบะ ป้ายทะเบียนสีฟ้า`.
- Customer-facing repair coverage filters use `GarageCd`: `G` for dealer repair and blank for garage repair.

## QA After Import

- Open `/line-app/search` and confirm vehicle class, coverage, repair type, brand, model, year, cubic capacity, and sum insured options appear.
- Search one known campaign row and confirm the result count is expected.
- Open Admin campaign details and fill provider contact plus payment setup before running a real checkout.

## Premium Import QA

Use this after every CSV import or campaign replacement.

1. Open `/admin/insurance`.
2. Find the `Import QA` card named `ตรวจสอบเบี้ยประกันจาก prm_gapnew`.
3. Confirm the status badge says `ผ่าน`.
4. Confirm `ไม่ตรงกัน` is `0`.
5. Confirm `มี prm_gapnew` equals the imported campaign package count. The QA card checks campaign import rows only, meaning rows with `companyCode`, `campaignCode`, and `rawData`.
   Manual/sample packages without campaign import metadata are ignored by this QA check.
   For current production CSV campaign data, `ไม่มี prm_gapnew` should be `0`.
6. If `ไม่ตรงกัน` is greater than `0`, inspect the example table:
   - `netPrice` is what the customer sees as `เบี้ยประกัน`.
   - `prm_gapnew` is the CSV source value.
   - These two values must match for rows with `prm_gapnew`.
7. If mismatches appear, do not continue production QA until the import mapping or data has been corrected.

Expected price mapping:

- Customer `เบี้ยประกัน` = `InsurancePackage.netPrice` = CSV `prm_gapnew`.
- Customer `คงเหลือชำระ` = `InsurancePackage.payablePrice` = CSV `paid`.
- If CTP/CMI is selected, totals add the configured CTP/CMI amount separately.
