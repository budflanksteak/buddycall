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

    const getEntry = (user: { id: string; name: string | null; email: string; callType: string | null; fte: number }) => {
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

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="schedule-${schedule.name.replace(/\s+/g, '-')}.xlsx"`,
      },
    })
  }

  return NextResponse.json(schedule)
}

// PATCH — update a single assignment (primary or buddy)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { assignmentId, primaryUserId, buddyUserId } = body

  if (!assignmentId) {
    return NextResponse.json({ error: 'assignmentId required' }, { status: 400 })
  }

  // Verify the assignment belongs to this schedule
  const existing = await prisma.callAssignment.findUnique({ where: { id: assignmentId } })
  if (!existing || existing.scheduleId !== params.id) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }

  const updated = await prisma.callAssignment.update({
    where: { id: assignmentId },
    data: {
      primaryUserId: primaryUserId === '' ? null : primaryUserId ?? existing.primaryUserId,
      buddyUserId: buddyUserId === '' ? null : buddyUserId ?? existing.buddyUserId,
    },
    include: {
      primaryUser: { select: { id: true, name: true, email: true } },
      buddyUser:   { select: { id: true, name: true, email: true } },
    },
  })

  return NextResponse.json(updated)
}
