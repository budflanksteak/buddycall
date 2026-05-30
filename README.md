# Neurorad Call Autopilot — BuddyCall

A full-stack web application for equitable Neuroradiology weekend and holiday call scheduling. Automatically distributes primary call assignments across faculty by cFTE, respects individual preferences and blocked dates, and tracks cumulative workload credits across academic years.

**Live app:** [https://neuroradbuddycall.vercel.app](https://neuroradbuddycall.vercel.app)

---

## Features

### Scheduling
- **Two call types** — Loner (independent) and Buddy (always paired with a partner)
- **Auto-assignment engine** — Two-phase scheduler that prioritises primary call equity across all faculty proportional to cFTE
- **Faculty preferences** — Weekend style (full/single day), holiday grouping, assignment spacing, cFTE, and permanently blocked holidays
- **Manual schedule editing** — Admin can override any individual Primary or Buddy assignment after auto-assign runs via an inline edit modal
- **Unassigned date handling** — When all faculty have a date blocked, an explicit unassigned row is saved (red background, Assign button) rather than silently dropping the date; flagged for manual reconciliation
- **Publish & credit log** — Publishing a schedule locks it and automatically updates the perpetual academic year credit log

### Faculty & Calendar
- **Blocked dates calendar** — Faculty block individual weekend/holiday dates per schedule period
- **Admin calendar view** — Admin can view and edit any faculty member's availability calendar via a faculty selector dropdown
- **Perpetual credit log** — Cumulative primary days, buddy days, holiday days, and workload units tracked per academic year (July–June), carried forward across schedule blocks

### Qgenda Integration
- **StaffKey linking** — Each faculty record stores a `staffKey` (UUID) matching the corresponding record in the external qgenda MySQL staff database
- **Qgenda History tab** — Per-faculty summary of historic and future call assignments sourced from qgenda, broken down by Saturday, Sunday, and Holiday for both Primary and Buddy call
- **Expandable row detail** — Clicking a faculty row reveals a full assignment list with date, day, Primary/Buddy badge, Holiday/Upcoming flags, and task name
- **Adjustable lookback** — Year filter buttons (2019 → current year) control how far back the history table and export reach
- **Qgenda XLSX export** — Downloads two sheets: Summary (per-faculty counts + totals) and All Assignments (every individual log entry)
- **Qgenda sync agent** — Standalone hourly Node.js agent (`qgenda-sync`) that polls the qgenda `liveschedule` MySQL table and writes call history to `QgendaLog` and No Call dates to `BlockedDate` in Supabase

### Admin & Auth
- **Admin dashboard** — Manage faculty, set preferences on behalf of any user, create/publish/delete schedules, view credit log
- **XLSX export** — Schedule and faculty summary export with workload unit breakdown
- **Password reset via email** — Gmail SMTP with app password
- **Temp password logic** — New faculty accounts use lowercase last name; names under 5 characters are padded with `2026`

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
| External schedule | qgenda MySQL (`liveschedule` table) via `qgenda-sync` agent |

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

## Qgenda Integration

BuddyCall integrates with the **qgenda** scheduling system via a standalone sync agent located in the `qgenda-sync/` directory (separate repository/folder from the main app).

### StaffKey

Each `User` record has a `staffKey` field (VARCHAR 36 UUID) that matches the corresponding `StaffKey` in the qgenda MySQL `liveradiologists` table. This is the join key used by the sync agent.

### Qgenda Sync Agent

The sync agent (`qgenda-sync/`) is a standalone Node.js process that runs independently of the Next.js app. It connects to both the qgenda MySQL database and Supabase directly.

**What it syncs:**

| TaskKey | TaskName | Action |
|---|---|---|
| `47952619-3c8d-4e58-a882-25e45b2d212d` | NEURO - Neuro Primary Call | Written to `QgendaLog` as `callType=primary` |
| `a642828d-7ee7-4235-baf2-dcff66be7b85` | NEURO - Neuro Buddy Call | Written to `QgendaLog` as `callType=buddy` |
| `f9063d6b-dcbd-4792-839a-59a19ade2a4f` | NEURO - No Call | Future dates written to `BlockedDate` |

Only weekend days (`Weekday = 5 or 6`) and holidays (`Holiday = 1`) are synced.

**Running the sync agent:**

```bash
cd qgenda-sync
npm install
cp .env.example .env
# Edit .env with MySQL credentials and Supabase connection string
node src/index.js
```

**Scheduling (Windows Task Scheduler):**

```cmd
schtasks /create /tn "QgendaSync" /tr "C:\path\to\qgenda-sync\run-sync.bat" /sc hourly /mo 1 /f
```

Logs are written to `qgenda-sync/logs/sync.log`.

**Qgenda sync agent folder structure:**
```
qgenda-sync/
├── .env                  ← MySQL + Supabase credentials (not committed)
├── .env.example
├── package.json
├── run-sync.bat          ← Windows batch wrapper for Task Scheduler
├── logs/
│   └── sync.log
├── prisma/
│   └── schema.prisma     ← Supabase schema subset (User, QgendaLog, BlockedDate)
└── src/
    ├── index.js          ← Entry point
    ├── mysql.js          ← MySQL connection
    ├── supabase.js       ← Prisma/Supabase connection
    └── sync.js           ← Core sync logic
```

### Qgenda History Tab

In the admin dashboard, the **Qgenda History** tab shows a per-faculty summary table:

| Column | Description |
|---|---|
| P·Sat / P·Sun / P·Hol | Historic Primary Call days on Saturdays, Sundays, Holidays |
| B·Sat / B·Sun / B·Hol | Historic Buddy Call days on Saturdays, Sundays, Holidays |
| Future | Upcoming assigned call dates not yet passed |
| Last Sync | Timestamp of the most recent sync for that faculty member |

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
│       ├── admin/      # Admin-only API routes (users, schedules, credits, qgenda-history)
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
