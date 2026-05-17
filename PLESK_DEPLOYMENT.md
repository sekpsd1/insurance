# Plesk Deployment

This app can run on Plesk Node.js hosting.

## Plesk Node.js Settings

- Node.js version: use Node 20+.
- Application mode: `production`.
- Application root: the project root, for example `/app.your-domain.com`.
- Document root: `public`.
- Application startup file: `server.js`.
- Package manager: `npm`.

## Environment Variables

Set these in **Custom environment variables**:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DB_NAME"
ADMIN_PASSWORD="use-a-long-password"
ADMIN_SESSION_SECRET="use-a-different-long-random-secret"
APP_BASE_URL="https://your-domain.example"
EMAIL_PROVIDER="resend"
EMAIL_FROM="Insurance Broker <noreply@your-domain.example>"
RESEND_API_KEY="..."
UPLOAD_STORAGE_DRIVER="s3"
S3_ENDPOINT="https://..."
S3_REGION="auto"
S3_BUCKET="..."
S3_ACCESS_KEY_ID="..."
S3_SECRET_ACCESS_KEY="..."
S3_PUBLIC_BASE_URL="https://..."
```

For temporary local disk uploads on Plesk only when the disk is persistent:

```env
UPLOAD_STORAGE_DRIVER="local"
ALLOW_LOCAL_UPLOADS_IN_PRODUCTION="true"
```

## First Deploy

1. Upload the project files to the application root.
2. In Plesk Node.js, click **NPM install**.
3. Use **Run script** for:
   - `prisma:generate`
   - `build`
4. Apply the database schema with the chosen production workflow.
5. Click **Restart App**.
6. Open `/api/health`.
7. Run `npm run smoke` from Plesk commands if available.

## Common Issues

- If `/api/health` fails, check `DATABASE_URL` and database user permissions.
- If provider email stays `ERROR`, check `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_BASE_URL`.
- If uploads fail in production, configure S3/R2 or explicitly allow local uploads only on persistent storage.
- Keep the document root as `public` so source files and env files are not web-accessible.
