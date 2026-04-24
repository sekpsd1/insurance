# LINE Mini App Insurance

Next.js 15 + TypeScript + Tailwind CSS + Prisma starter for a car insurance mini app.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment file:
   ```bash
   copy .env.example .env
   ```
3. Set your MySQL `DATABASE_URL` in `.env`.
4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
5. Run development server:
   ```bash
   npm run dev
   ```

## Deploy on Plesk

- Build with `npm run build`
- Run with `npm run start`
- `next.config.js` is set to `output: 'standalone'` for Node.js server deployment
