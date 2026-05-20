import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url      = new URL(req.url)
  const userId   = url.searchParams.get('userId') ?? undefined
  const fromYear = parseInt(url.searchParams.get('fromYear') ?? '2019', 10)
  const fromDate = new Date(fromYear, 0, 1) // Jan 1 of fromYear

  const logs = await prisma.qgendaLog.findMany({
    where: {
      ...(userId ? { userId } : {}),
      date: { gte: fromDate },
    },
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { date: 'desc' },
  })

  const users = await prisma.user.findMany({
    where: { isActive: true, staffKey: { not: null } },
    select: {
      id: true, name: true, email: true, callType: true,
      qgendaLogs: {
        where: { date: { gte: fromDate } },
        select: { callType: true, date: true, isWeekend: true, isHoliday: true, syncedAt: true }
      },
    },
  })

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const summary = users.map(u => {
    const entries = u.qgendaLogs
    const past    = entries.filter(e => new Date(e.date) < today)
    const future  = entries.filter(e => new Date(e.date) >= today)
    const sorted  = [...entries].sort((a, b) => new Date(b.syncedAt).getTime() - new Date(a.syncedAt).getTime())

    return {
      userId:         u.id,
      name:           u.name,
      email:          u.email,
      callType:       u.callType,
      primarySat:     past.filter(e => e.callType === 'primary' && e.isWeekend && new Date(e.date).getDay() === 6).length,
      primarySun:     past.filter(e => e.callType === 'primary' && e.isWeekend && new Date(e.date).getDay() === 0).length,
      primaryHoliday: past.filter(e => e.callType === 'primary' && e.isHoliday).length,
      buddySat:       past.filter(e => e.callType === 'buddy'   && e.isWeekend && new Date(e.date).getDay() === 6).length,
      buddySun:       past.filter(e => e.callType === 'buddy'   && e.isWeekend && new Date(e.date).getDay() === 0).length,
      buddyHoliday:   past.filter(e => e.callType === 'buddy'   && e.isHoliday).length,
      futureAssigned: future.length,
      lastSynced:     sorted.length ? sorted[0].syncedAt : null,
    }
  })

  // ── XLSX export ──────────────────────────────────────────────────────────
  if (url.searchParams.get('export') === 'xlsx') {
    const wb = XLSX.utils.book_new()

    // Sheet 1: Summary
    const summaryRows = [
      ['Faculty', 'Type', 'P·Sat', 'P·Sun', 'P·Hol', 'B·Sat', 'B·Sun', 'B·Hol', 'Future Assigned', 'Last Synced'],
      ...summary.map(r => [
        r.name || r.email,
        r.callType || '',
        r.primarySat, r.primarySun, r.primaryHoliday,
        r.buddySat,   r.buddySun,   r.buddyHoliday,
        r.futureAssigned,
        r.lastSynced ? format(new Date(r.lastSynced), 'MM/dd/yyyy HH:mm') : '',
      ]),
      // Totals row
      [
        'TOTALS', '',
        summary.reduce((s, r) => s + r.primarySat, 0),
        summary.reduce((s, r) => s + r.primarySun, 0),
        summary.reduce((s, r) => s + r.primaryHoliday, 0),
        summary.reduce((s, r) => s + r.buddySat, 0),
        summary.reduce((s, r) => s + r.buddySun, 0),
        summary.reduce((s, r) => s + r.buddyHoliday, 0),
        summary.reduce((s, r) => s + r.futureAssigned, 0),
        '',
      ],
    ]
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
    wsSummary['!cols'] = [20, 10, 6, 6, 6, 6, 6, 6, 14, 18].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

    // Sheet 2: Individual assignments
    const detailRows = [
      ['Faculty', 'Email', 'Date', 'Day', 'Assignment', 'Weekend', 'Holiday', 'Upcoming', 'Task Name'],
      ...logs.map(l => {
        const d = new Date(l.date)
        const today = new Date(); today.setHours(0,0,0,0)
        return [
          (l as any).user?.name || '',
          (l as any).user?.email || '',
          format(d, 'MM/dd/yyyy'),
          format(d, 'EEE'),
          l.callType,
          (l as any).isWeekend ? 'Yes' : 'No',
          (l as any).isHoliday ? 'Yes' : 'No',
          d >= today ? 'Yes' : 'No',
          (l as any).taskName || '',
        ]
      }),
    ]
    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows)
    wsDetail['!cols'] = [20, 28, 12, 6, 12, 9, 9, 10, 32].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, wsDetail, 'All Assignments')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const yearLabel = `${fromYear}-${new Date().getFullYear()}`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="qgenda-history-${yearLabel}.xlsx"`,
      },
    })
  }

  return NextResponse.json({ logs, summary })
}
