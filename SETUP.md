# Neurorad AutoPilot — Setup Guide

## Prerequisites

You need **Node.js 18+** installed. Get it from:
- https://nodejs.org/en/download (Windows installer)
- Or via Homebrew (macOS): `brew install node`

## Quick Start (Local Development)

```bash
# 1. Enter the project directory
cd "buddycall"

# 2. Install dependencies
npm install

# 3. Set up the database
npx prisma db push

# 4. (Optional) Seed with sample data
npm run db:seed

# 5. Start the development server
npm run dev
```

Then open **http://localhost:3000** in your browser.

The **first user to register** is automatically made an Admin.

---

## Environment Configuration

Edit `.env` with your settings:

```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="change-this-to-a-random-32-char-string"
NEXTAUTH_URL="http://localhost:3000"

# Email (for password reset / verification)
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT=587
EMAIL_SERVER_USER="youraddress@gmail.com"
EMAIL_SERVER_PASSWORD="your-gmail-app-password"
EMAIL_FROM="Neurorad AutoPilot <noreply@yourdomain.com>"
```

> **Gmail App Password**: Go to Google Account → Security → 2-Step Verification → App Passwords

---

## Deploying to Vercel

1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repo
3. Add a PostgreSQL database (Vercel Postgres, Supabase, or Neon)
4. Update your `.env` variables in Vercel's dashboard:
   - Change `DATABASE_URL` to your PostgreSQL connection string
   - Change `DATABASE_URL` in `prisma/schema.prisma` provider to `postgresql`
   - Set `NEXTAUTH_URL` to your Vercel deployment URL
   - Set `NEXTAUTH_SECRET` to a secure random string
5. Deploy!

### Switch to PostgreSQL for Vercel

In `prisma/schema.prisma`, change:
```
datasource db {
  provider = "sqlite"      ← change to "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Running on Windows Apache (Local Production)

1. Install Node.js
2. Run `npm install && npm run build`
3. In Apache `httpd.conf` or a virtual host file, set up a reverse proxy:

```apache
ProxyPass / http://localhost:3000/
ProxyPassReverse / http://localhost:3000/
```

4. Start the app with: `npm start` (keep running in background with PM2: `pm2 start npm --name "neurorad" -- start`)

---

## Application Overview

### User Roles

| Role | Access |
|------|--------|
| Faculty | Profile, calendar, view own assignments |
| Admin | Everything above + user management, schedule creation, XLSX export |

### Features

- **Profile Setup**: Each physician sets their call type (Loner/Buddy), weekend preference (full/single), holiday preference, FTE, and spacing preference
- **Availability Calendar**: Perpetual calendar to block out unavailable dates with reasons
- **Auto-Assignment Algorithm**: Equitably distributes call days respecting blocked dates, buddy pairing, FTE weighting, and spacing preferences
- **Schedule Management**: Create, publish, re-run, and download schedules
- **XLSX Export**: Two-sheet workbook: full schedule + faculty summary
- **Equity Score**: 0–100 score showing how balanced assignments are

### Call Types

- **Loner**: Works independently. Assigned primary call only.
- **Buddy**: Always paired with another buddy physician. Gets both primary and buddy assignments. Buddies are always assigned in pairs.

### Schedule Spans

- **Quarter**: ~3 months
- **Half Year**: 6 months
- **Full Year**: 12 months
- **Variable**: Custom date range

---

## Database Management

```bash
# View database in browser GUI
npm run db:studio

# Reset database
npx prisma db push --force-reset

# Re-seed with sample data
npm run db:seed
```

---

## Troubleshooting

**"Cannot find module '@prisma/client'"**
```bash
npx prisma generate
```

**Email not sending**
- Verify SMTP credentials in `.env`
- For Gmail, use an App Password (not your regular password)
- The app still works without email — verify tokens are printed to console in dev mode

**"Invalid NEXTAUTH_SECRET"**
- Generate a secret: `openssl rand -base64 32`
- Set it in `.env`
