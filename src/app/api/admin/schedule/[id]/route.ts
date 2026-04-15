import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateScheduleXLSX } from '@/lib/xlsx-export'
import { format } from 'date-fns'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: params.id },
    include: {
      assignments: {
        include: {
          primaryUser: { select: { id: true, name: true, email: true, callType: true, fte: true } },
          buddyUser:   { select: { id: true, name: true, email: true, callType: true, fte: true } },
        },
        orderBy: { date: 'asc' },
      },
    },
  })

  if (!schedule) {
    return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
  }

  const url = new URL(req.url)
  const exportFormat = url.searchParams.get('export')

  if (exportFormat === 'xlsx') {
    // Build per-user stats for the summary sheet
    const userMap = new Map<string, {
      name: string | null; email: string; callType: string | null; fte: number
      primaryDays: number; buddyDays: number; holidays: number; workloadUnits: number
    }>()

    function getEntry(user: { id: string; name: string | null; email: string; callType: string | null; fte: number }) {
      if (!userMap.has(user.id)) {
        userMap.set(user.id, {
          name: user.name, email: user.email,
          callType: user.callType, fte: user.fte,
          primaryDays: 0, buddyDays: 0, holidays: 0, workloadUnits: 0,
        })
      }
      return userMap.get(user.id)!
    }

    for (const a of schedule.assignments) {
      const isHol = a.dayType === 'holiday'

      if (a.primaryUser) {
        const e = getEntry(a.primaryUser)
        e.primaryDays++
        if (isHol) e.holidays++
        // Loner covers both roles alone → 2 workload units; buddy primary → 1
        e.workloadUnits += a.primaryUser.callType === 'loner' ? 2 : 1
      }

      if (a.buddyUser) {
        const e = getEntry(a.buddyUser)
        e.buddyDays++
        if (isHol) e.holidays++
        e.workloadUnits += 1
      }
    }

    const buffer = generateScheduleXLSX(
      schedule.name,
      format(new Date(schedule.startDate), 'MM/dd/yyyy'),
      format(new Date(schedule.endDate), 'MM/dd/yyyy'),
      schedule.assignments as any,
      Array.from(userMap.values()),
    )

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="schedule-${schedule.name.replace(/\s+/g, '-')}.xlsx"`,
      },
    })
  }

  return NextResponse.json(schedule)
}
