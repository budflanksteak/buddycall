import { prisma } from './prisma'
import { eachDayOfInterval, isSaturday, isSunday, format, differenceInDays } from 'date-fns'
import { getFederalHolidays, getAcademicYear } from './utils'

type User = {
  id: string
  name: string | null
  callType: string | null
  fte: number
  spacingPreference: string | null
  blockedHolidays: string
}

type CallDay = {
  date: Date
  type: 'saturday' | 'sunday' | 'holiday'
}

type Assignment = {
  date: Date
  dayType: string
  primaryUserId: string
  buddyUserId?: string
}

export type UserStat = {
  userId: string
  name: string
  callType: string
  primaryDays: number
  buddyDays: number
  holidays: number
  workloadUnits: number
  targetPrimaryDays: number
  primaryBalance: number  // actual primary - target primary
}

export type SchedulerResult = {
  assignments: Assignment[]
  stats: {
    totalDays: number
    assignedDays: number
    unassignedDays: number
    userStats: UserStat[]
    warnings: string[]
    score: number
  }
}

// Workload credit constants (for credit log only, not scheduling decisions)
const LONER_UNITS_PER_DAY = 2  // loner covers both roles alone
const BUDDY_UNITS_PER_DAY = 1  // each buddy covers one role

export async function autoAssignSchedule(
  scheduleId: string,
  startDate: Date,
  endDate: Date
): Promise<SchedulerResult> {

  // ── Load data ─────────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { isActive: true, profileComplete: true },
  })

  if (users.length === 0) {
    return {
      assignments: [],
      stats: { totalDays: 0, assignedDays: 0, unassignedDays: 0, userStats: [], warnings: ['No active faculty with complete profiles.'], score: 0 },
    }
  }

  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      date: { gte: startDate, lte: endDate },
    },
  })

  const blockedMap = new Map<string, Set<string>>()
  for (const b of blockedDates) {
    if (!blockedMap.has(b.userId)) blockedMap.set(b.userId, new Set())
    blockedMap.get(b.userId)!.add(format(new Date(b.date), 'yyyy-MM-dd'))
  }

  // Load prior credit log carry-over for this academic year window
  const academicYears = new Set<string>()
  const cur = new Date(startDate)
  while (cur <= endDate) {
    academicYears.add(getAcademicYear(cur))
    cur.setMonth(cur.getMonth() + 1)
  }

  const priorCredits = await prisma.creditLog.findMany({
    where: {
      userId: { in: users.map(u => u.id) },
      academicYear: { in: Array.from(academicYears) },
    },
  })

  // Prior primary days already credited this academic year
  const priorPrimary = new Map<string, number>()
  users.forEach(u => priorPrimary.set(u.id, 0))
  for (const c of priorCredits) {
    priorPrimary.set(c.userId, (priorPrimary.get(c.userId) || 0) + c.primaryDays)
  }

  // ── Build holiday maps ────────────────────────────────────────────────────
  const holidayNameMap = new Map<string, string>()
  for (let y = startDate.getFullYear(); y <= endDate.getFullYear(); y++) {
    for (const h of getFederalHolidays(y)) {
      holidayNameMap.set(format(h.date, 'yyyy-MM-dd'), h.name)
    }
  }

  // ── Build call day list ───────────────────────────────────────────────────
  const callDays: CallDay[] = []
  for (const day of eachDayOfInterval({ start: startDate, end: endDate })) {
    const ds = format(day, 'yyyy-MM-dd')
    const isHol = holidayNameMap.has(ds)
    const isSat = isSaturday(day)
    const isSun = isSunday(day)
    if (isSat || isSun || isHol) {
      callDays.push({ date: day, type: isHol ? 'holiday' : isSat ? 'saturday' : 'sunday' })
    }
  }

  const totalDays = callDays.length
  const totalFTE = users.reduce((s, u) => s + u.fte, 0)

  // Per-user primary target for this period only
  // Every faculty member (loner and buddy) shares primary equally by FTE
  const primaryTarget = new Map<string, number>()
  users.forEach(u => primaryTarget.set(u.id, (u.fte / totalFTE) * totalDays))

  // ── Counters ──────────────────────────────────────────────────────────────
  const primaryCount  = new Map<string, number>()
  const buddyCount    = new Map<string, number>()
  const holidayCount  = new Map<string, number>()
  const lastDate      = new Map<string, Date>()
  users.forEach(u => { primaryCount.set(u.id, 0); buddyCount.set(u.id, 0); holidayCount.set(u.id, 0) })

  const warnings: string[] = []
  const assignments: Assignment[] = []

  const buddyUsers = users.filter(u => u.callType === 'buddy')

  // ── Helpers ───────────────────────────────────────────────────────────────

  function isAvailable(user: User, date: Date): boolean {
    const ds = format(date, 'yyyy-MM-dd')
    if (blockedMap.get(user.id)?.has(ds)) return false
    const holName = holidayNameMap.get(ds)
    if (holName) {
      try {
        const blocked: string[] = JSON.parse(user.blockedHolidays || '[]')
        if (blocked.includes(holName)) return false
      } catch {}
    }
    return true
  }

  // Primary deficit: how many primary days below target is this person?
  // Incorporates prior credit carry-over so long-term equity is maintained.
  function primaryDeficit(user: User): number {
    const target   = primaryTarget.get(user.id) || 0
    const current  = primaryCount.get(user.id) || 0
    const prior    = priorPrimary.get(user.id) || 0
    // Scale prior by the fraction of academic year this period represents
    // so carry-over nudges but doesn't dominate a short block
    const periodFraction = totalDays / Math.max(totalDays + prior, 1)
    const adjustedPrior  = prior * (1 - periodFraction) * 0.4
    return target - current - adjustedPrior
  }

  // Spacing tiebreaker: small penalty only if user prefers maximized spacing
  function spacingPenalty(user: User, date: Date): number {
    if (user.spacingPreference !== 'maximize') return 0
    const last = lastDate.get(user.id)
    if (!last) return 0
    const days = differenceInDays(date, last)
    return days < 14 ? (14 - days) * 0.5 : 0  // small compared to deficit
  }

  // Score for PRIMARY selection (lower = better candidate)
  // Driven almost entirely by primary deficit; spacing is a minor tiebreaker
  function primaryScore(user: User, date: Date): number {
    return -primaryDeficit(user) + spacingPenalty(user, date)
  }

  // Score for BUDDY PARTNER selection (lower = better candidate)
  // Driven by who has done the fewest buddy days
  function buddyPartnerScore(user: User, date: Date): number {
    const buddyDays = buddyCount.get(user.id) || 0
    return buddyDays + spacingPenalty(user, date)
  }

  // ── Main assignment loop ──────────────────────────────────────────────────
  const sorted = [...callDays].sort((a, b) => a.date.getTime() - b.date.getTime())

  for (const { date, type } of sorted) {
    const avail = users.filter(u => isAvailable(u, date))

    if (avail.length === 0) {
      warnings.push(`${format(date, 'MMM d, yyyy')}: No available faculty — unassigned!`)
      continue
    }

    // ── Phase 1: Pick primary (all faculty compete equally) ──────────────
    const sortedByPrimary = [...avail].sort((a, b) => primaryScore(a, date) - primaryScore(b, date))
    const primary = sortedByPrimary[0]

    // ── Phase 2: If primary is a buddy, assign a partner ─────────────────
    let buddy: User | undefined
    if (primary.callType === 'buddy') {
      const availBuddies = buddyUsers.filter(u => u.id !== primary.id && isAvailable(u, date))
      if (availBuddies.length > 0) {
        buddy = [...availBuddies].sort((a, b) => buddyPartnerScore(a, date) - buddyPartnerScore(b, date))[0]
      } else {
        warnings.push(`${format(date, 'MMM d, yyyy')}: ${primary.name} (buddy) has no available partner.`)
      }
    }

    // ── Record assignment ─────────────────────────────────────────────────
    assignments.push({ date, dayType: type, primaryUserId: primary.id, buddyUserId: buddy?.id })

    primaryCount.set(primary.id, (primaryCount.get(primary.id) || 0) + 1)
    lastDate.set(primary.id, date)

    if (buddy) {
      buddyCount.set(buddy.id, (buddyCount.get(buddy.id) || 0) + 1)
      lastDate.set(buddy.id, date)
    }

    if (type === 'holiday') {
      holidayCount.set(primary.id, (holidayCount.get(primary.id) || 0) + 1)
      if (buddy) holidayCount.set(buddy.id, (holidayCount.get(buddy.id) || 0) + 1)
    }
  }

  // ── Build stats ───────────────────────────────────────────────────────────
  const userStats: UserStat[] = users.map(u => {
    const pd   = primaryCount.get(u.id) || 0
    const bd   = buddyCount.get(u.id) || 0
    const hd   = holidayCount.get(u.id) || 0
    const tgt  = Math.round((primaryTarget.get(u.id) || 0) * 10) / 10
    const units = u.callType === 'loner' ? pd * LONER_UNITS_PER_DAY : pd * BUDDY_UNITS_PER_DAY + bd * BUDDY_UNITS_PER_DAY
    return {
      userId: u.id,
      name: u.name || u.id,
      callType: u.callType || 'unknown',
      primaryDays: pd,
      buddyDays: bd,
      holidays: hd,
      workloadUnits: units,
      targetPrimaryDays: tgt,
      primaryBalance: Math.round((pd - tgt) * 10) / 10,
    }
  })

  // Equity score based solely on primary day deviations (the paramount metric)
  const deviations = userStats.map(s => Math.abs(s.primaryBalance))
  const avgDev = deviations.reduce((a, b) => a + b, 0) / Math.max(deviations.length, 1)
  const score = Math.max(0, Math.round(100 - avgDev * 15))

  // ── Save to DB ────────────────────────────────────────────────────────────
  await prisma.callAssignment.deleteMany({ where: { scheduleId } })
  for (const a of assignments) {
    await prisma.callAssignment.create({
      data: {
        date: a.date,
        dayType: a.dayType,
        assignmentType: a.buddyUserId ? 'buddy-pair' : 'primary',
        primaryUserId: a.primaryUserId,
        buddyUserId: a.buddyUserId,
        scheduleId,
      },
    })
  }

  return {
    assignments,
    stats: { totalDays, assignedDays: assignments.length, unassignedDays: totalDays - assignments.length, userStats, warnings, score },
  }
}

// ── Credit log (called on publish) ───────────────────────────────────────────
export async function publishCredits(scheduleId: string): Promise<void> {
  const assignments = await prisma.callAssignment.findMany({
    where: { scheduleId },
    include: {
      primaryUser: { select: { id: true, callType: true } },
      buddyUser:   { select: { id: true } },
    },
  })

  type Accum = { primaryDays: number; buddyDays: number; holidayDays: number; workloadUnits: number }
  const map = new Map<string, Map<string, Accum>>()

  function accum(userId: string, year: string): Accum {
    if (!map.has(userId)) map.set(userId, new Map())
    const ym = map.get(userId)!
    if (!ym.has(year)) ym.set(year, { primaryDays: 0, buddyDays: 0, holidayDays: 0, workloadUnits: 0 })
    return ym.get(year)!
  }

  for (const a of assignments) {
    const year  = getAcademicYear(new Date(a.date))
    const isHol = a.dayType === 'holiday'

    if (a.primaryUser) {
      const isLoner = a.primaryUser.callType === 'loner'
      const ac = accum(a.primaryUser.id, year)
      ac.primaryDays++
      if (isHol) ac.holidayDays++
      ac.workloadUnits += isLoner ? LONER_UNITS_PER_DAY : BUDDY_UNITS_PER_DAY
    }

    if (a.buddyUser) {
      const ac = accum(a.buddyUser.id, year)
      ac.buddyDays++
      if (isHol) ac.holidayDays++
      ac.workloadUnits += BUDDY_UNITS_PER_DAY
    }
  }

  for (const [userId, yearMap] of map.entries()) {
    for (const [academicYear, ac] of yearMap.entries()) {
      await prisma.creditLog.upsert({
        where: { userId_academicYear: { userId, academicYear } },
        update: {
          primaryDays:   { increment: ac.primaryDays },
          buddyDays:     { increment: ac.buddyDays },
          holidayDays:   { increment: ac.holidayDays },
          workloadUnits: { increment: ac.workloadUnits },
        },
        create: { userId, academicYear, ...ac },
      })
    }
  }
}
