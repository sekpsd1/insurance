# Deployment Checklist

Use this before deploying the app to a public host.

## Required Environment

- `DATABASE_URL` points to the production MySQL database.
- `ADMIN_PASSWORD` is long and unique.
- `ADMIN_SESSION_SECRET` is set to a separate long random value.
- `APP_BASE_URL` is the public HTTPS origin of the app.
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and `EMAIL_FROM` are configured before relying on provider Magic Link email delivery.
- Prefer `UPLOAD_STORAGE_DRIVER=s3` with `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and `S3_PUBLIC_BASE_URL`.
- Use `ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true` only when the host has persistent disk storage.

## Database

- Run `npx prisma validate`.
- Apply the production schema with a real migration workflow or an approved `npx prisma db push` for the target environment.
- Take a database backup before schema changes.

## Admin Checks

- Open `/admin/readiness` and resolve any `error` items.
- Review `CSV_IMPORT_GUIDE.md` before importing production package data.

## Smoke Tests

- `GET /api/health` returns `status: ok`.
- `/line-app/search` loads search options.
- A checkout creates an `EmailOutbox` row and sends or records a clear delivery error.
- `/admin` requires login.
- `/insurance/update/[token]` opens with a valid token and blocks reuse after a terminal provider status.
- Run `npm run smoke` after the production app is started.

## Plesk

- Use `server.js` as the Node.js startup file.
- Set the document root to `public`.
- Run `npm install`, `npm run prisma:generate`, and `npm run build`.
- See `PLESK_DEPLOYMENT.md` for the full field-by-field setup.

## Uploads

- Verify slip, logo, and payment QR uploads with PNG/JPG/WebP/GIF files.
- Verify oversized or renamed non-image files are rejected.
- Confirm uploaded files persist after a redeploy/restart.
- If using S3/R2, confirm uploaded object URLs are publicly readable through `S3_PUBLIC_BASE_URL`.
