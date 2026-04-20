# Neurorad AutoPilot — BuddyCall

A full-stack web application for equitable Neuroradiology weekend and holiday call scheduling. Automatically distributes primary call assignments across faculty by FTE, respects individual preferences and blocked dates, and tracks cumulative workload credits across academic years.

**Live app:** [https://neuroradbuddycall.vercel.app](https://neuroradbuddycall.vercel.app)

---

## Features

- **Two call types** — Loner (independent) and Buddy (always paired with a partner)
- **Auto-assignment engine** — Two-phase scheduler that prioritises primary call equity across all faculty proportional to FTE
- **Faculty preferences** — Weekend style (full/single day), holiday grouping, assignment spacing, FTE, and permanently blocked holidays
- **Blocked dates calendar** — Faculty can block individual dates per schedule period
- **Manual schedule editing** — Admin can override any individual assignment after auto-assign runs
- **Unassigned date handling** — Fully-blocked dates appear as red rows flagged for manual reconciliation rather than being silently dropped
- **Perpetual credit log** — Cumulative primary days, buddy days, holiday days, and workload units tracked per academic year (July–June), carried forward across schedule blocks
- **XLSX export** — Schedule and faculty summary export with workload unit breakdown
- **Password reset via email** — Gmail SMTP with app password
- **Admin dashboard** — Manage faculty, set preferences on behalf of users, create/publish/delete schedules, view credit log

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v5 (JWT, Credentials provider) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 5 |
| UI | Tailwind CSS + Radix UI (shadcn/ui) |
| Hosting | Vercel |
| Email | Nodemailer + Gmail SMTP |

---

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# 1. Clone the repo
git clone git@github.com:budflanksteak/buddycall.git
cd buddycall

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create your local environment file
cp .env.example .env
# Edit .env — the default SQLite config works out of the box for local dev

# 4. Push the schema to the local SQLite database
npx prisma db push

# 5. Start the dev server
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000). The first account registered is automatically granted admin role.

### Local vs Production Database

The local `.env` uses SQLite (`file:./dev.db`) — no external database needed for development. Production on Vercel uses the Supabase PostgreSQL instance. They are completely independent; changes to one do not affect the other.

---

## Deployment

The app is deployed on **Vercel** connected to **Supabase** PostgreSQL.

### Deploying code changes

Every change follows the same pattern:

```bash
git add .
git commit -m "description of change"
git push origin main
```

Then redeploy to Vercel:

```bash
npx vercel --prod
# Re-apply the friendly URL alias after each deploy:
npx vercel alias set https://buddycall-mu.vercel.app neuroradbuddycall.vercel.app
```

### Database schema changes

If you modify `prisma/schema.prisma`, push the schema to Supabase before deploying:

```bash
# Set production credentials temporarily
export DIRECT_URL="postgresql://postgres.quxbsngvdjhbkdnsrvkl:...@aws-1-us-east-2.pooler.supabase.com:5432/postgres"
export DATABASE_URL="$DIRECT_URL"
npx prisma db push
```

---

## Environment Variables

### Local (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite path: `file:./dev.db` |
| `DIRECT_URL` | Same as `DATABASE_URL` for local |
| `NEXTAUTH_SECRET` | Any random string for local dev |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `EMAIL_SERVER_*` | Optional — leave blank to skip email locally |

### Production (Vercel)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
| `DIRECT_URL` | Supabase session pooler URL (port 5432) |
| `NEXTAUTH_SECRET` | Secure random string (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://neuroradbuddycall.vercel.app` |
| `EMAIL_SERVER_HOST` | `smtp.gmail.com` |
| `EMAIL_SERVER_PORT` | `587` |
| `EMAIL_SERVER_USER` | Gmail address used for sending |
| `EMAIL_SERVER_PASSWORD` | Gmail app password (16 chars, no spaces) |
| `EMAIL_FROM` | Display name + address, e.g. `Neurorad AutoPilot <you@gmail.com>` |

---

## Scheduler Logic

### Phase 1 — Primary assignment
All faculty (loner and buddy alike) compete equally for primary call days. The candidate with the highest **primary deficit** (target days minus days assigned so far, adjusted for prior academic year carry-over) is selected. Spacing preference is a minor tiebreaker only.

### Phase 2 — Buddy partner
If the selected primary is a buddy-type physician, the buddy with the fewest buddy days who is available on that date is paired as the partner.

### Unassigned dates
If every faculty member has a date blocked, the date is saved as an explicit unassigned record. In the View Schedule tab it appears as a red-highlighted row with an **Assign** button for manual reconciliation.

### Workload units (credit log only)
- Loner primary day = **2 units** (covers both roles alone)
- Buddy primary day = **1 unit**
- Buddy day = **1 unit**

Workload units are tracked in the perpetual credit log and displayed in the admin Credit Log tab. They do **not** influence scheduling decisions — primary equity by day count is the scheduling metric.

---

## Project Structure

```
src/
├── app/
│   ├── admin/          # Admin dashboard (faculty, schedules, credit log)
│   ├── dashboard/      # Faculty dashboard (upcoming assignments, stats)
│   ├── profile/        # Faculty preference setup
│   ├── calendar/       # Faculty blocked dates calendar
│   └── api/
│       ├── admin/      # Admin-only API routes
│       ├── auth/       # Registration, login, password reset
│       └── users/      # Profile and blocked dates
├── lib/
│   ├── scheduler.ts    # Auto-assignment engine
│   ├── auth.ts         # NextAuth configuration
│   ├── prisma.ts       # Prisma client singleton
│   ├── email.ts        # Nodemailer email helpers
│   ├── utils.ts        # Federal holidays, academic year helpers
│   └── xlsx-export.ts  # XLSX workbook generation
└── components/
    ├── navbar.tsx
    └── ui/             # shadcn/ui components
prisma/
└── schema.prisma       # Database schema
```

---

## First-Time Setup (Production)

1. Register at [/register](https://neuroradbuddycall.vercel.app/register) — first account = admin
2. Go to **Admin → Add Faculty** and add all physicians
3. Set each physician's preferences via **Edit Prefs** in the Faculty tab
4. Go to **Create Schedule**, pick a date range, and click **Create & Auto-Assign**
5. Review the equity score and warnings in the results card
6. Use **View** to inspect the schedule; use **Edit/Assign** buttons for manual overrides
7. Click **Publish** to lock the schedule and update the credit log
