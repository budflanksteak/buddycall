import * as XLSX from 'xlsx'
import { format } from 'date-fns'

type Assignment = {
  date: Date | string
  dayType: string
  primaryUser: { name: string | null; email: string } | null
  buddyUser:   { name: string | null; email: string } | null
}

type UserStat = {
  name: string | null
  email: string
  callType: string | null
  fte: number
  primaryDays: number
  buddyDays: number
  holidays: number
  workloadUnits: number  // loner day=2, buddy day=1
}

export function generateScheduleXLSX(
  scheduleName: string,
  startDate: string,
  endDate: string,
  assignments: Assignment[],
  userStats: UserStat[]
): Buffer {
  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Schedule ──────────────────────────────────────────────────────
  const scheduleData = [
    ['Neurorad AutoPilot — Call Schedule'],
    [`${scheduleName}  |  ${startDate} to ${endDate}`],
    [],
    ['Date', 'Day', 'Type', 'Primary Physician', 'Buddy Physician'],
    ...assignments.map(a => {
      const d = new Date(a.date)
      return [
        format(d, 'MM/dd/yyyy'),
        format(d, 'EEEE'),
        a.dayType.charAt(0).toUpperCase() + a.dayType.slice(1),
        a.primaryUser?.name || a.primaryUser?.email || 'Unassigned',
        a.buddyUser?.name  || a.buddyUser?.email  || '—',
      ]
    }),
  ]

  const schedSheet = XLSX.utils.aoa_to_sheet(scheduleData)
  schedSheet['!cols'] = [
    { wch: 13 }, { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 30 },
  ]
  XLSX.utils.book_append_sheet(wb, schedSheet, 'Schedule')

  // ── Sheet 2: Faculty Summary ───────────────────────────────────────────────
  const totalFTE = userStats.reduce((s, u) => s + u.fte, 0)
  const totalDays = assignments.length

  const summaryData = [
    ['Neurorad AutoPilot — Faculty Call Summary'],
    [`${scheduleName}  |  ${startDate} to ${endDate}`],
    [],
    [
      'Physician', 'Email', 'Call Type', 'FTE',
      'Primary Days', 'Target Primary', 'Buddy Days',
      'Holidays', 'Total Days', 'Workload Units',
      'Note',
    ],
    ...userStats
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      .map(u => {
        const target = Math.round((u.fte / (totalFTE || 1)) * totalDays * 10) / 10
        const note   = u.callType === 'loner'
          ? `Loner: ${u.primaryDays} days × 2 units (covers both roles alone)`
          : `Buddy: ${u.primaryDays} primary + ${u.buddyDays} buddy days`
        return [
          u.name || '—',
          u.email,
          u.callType ? u.callType.charAt(0).toUpperCase() + u.callType.slice(1) : '—',
          u.fte,
          u.primaryDays,
          target,
          u.buddyDays,
          u.holidays,
          u.primaryDays + u.buddyDays,
          u.workloadUnits,
          note,
        ]
      }),
    [],
    ['Workload Unit Key: Loner primary day = 2 units (solo coverage). Buddy primary or buddy day = 1 unit each.'],
  ]

  const summSheet = XLSX.utils.aoa_to_sheet(summaryData)
  summSheet['!cols'] = [
    { wch: 26 }, { wch: 30 }, { wch: 10 }, { wch: 5 },
    { wch: 13 }, { wch: 14 }, { wch: 11 },
    { wch: 10 }, { wch: 11 }, { wch: 15 },
    { wch: 55 },
  ]
  XLSX.utils.book_append_sheet(wb, summSheet, 'Faculty Summary')

  // ── Sheet 3: Holidays in range ─────────────────────────────────────────────
  const holidayRows = assignments
    .filter(a => a.dayType === 'holiday')
    .map(a => {
      const d = new Date(a.date)
      return [
        format(d, 'MM/dd/yyyy'),
        format(d, 'EEEE'),
        a.primaryUser?.name || a.primaryUser?.email || 'Unassigned',
        a.buddyUser?.name   || a.buddyUser?.email   || '—',
      ]
    })

  if (holidayRows.length > 0) {
    const holData = [
      ['Neurorad AutoPilot — Holiday Assignments'],
      [`${scheduleName}  |  ${startDate} to ${endDate}`],
      [],
      ['Date', 'Day', 'Primary Physician', 'Buddy Physician'],
      ...holidayRows,
    ]
    const holSheet = XLSX.utils.aoa_to_sheet(holData)
    holSheet['!cols'] = [{ wch: 13 }, { wch: 12 }, { wch: 30 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, holSheet, 'Holidays')
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
