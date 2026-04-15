import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { autoAssignSchedule, publishCredits } from '@/lib/scheduler'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const schedules = await prisma.schedule.findMany({
    include: {
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(schedules)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { name, startDate, endDate } = await req.json()
    if (!name || !startDate || !endDate) {
      return NextResponse.json({ error: 'name, startDate, endDate required' }, { status: 400 })
    }

    const schedule = await prisma.schedule.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        createdBy: session.user.id,
        status: 'draft',
      },
    })

    // Run auto-assignment
    const result = await autoAssignSchedule(
      schedule.id,
      new Date(startDate),
      new Date(endDate)
    )

    return NextResponse.json({ schedule, result })
  } catch (error: any) {
    console.error('Schedule creation error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { scheduleId, action } = await req.json()
    if (!scheduleId) return NextResponse.json({ error: 'scheduleId required' }, { status: 400 })

    const schedule = await prisma.schedule.findUnique({ where: { id: scheduleId } })
    if (!schedule) return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })

    if (action === 'reassign') {
      const result = await autoAssignSchedule(scheduleId, schedule.startDate, schedule.endDate)
      return NextResponse.json({ result })
    }

    if (action === 'publish') {
      await prisma.schedule.update({
        where: { id: scheduleId },
        data: { status: 'published' },
      })
      await publishCredits(scheduleId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Schedule update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { scheduleId } = await req.json()
    await prisma.callAssignment.deleteMany({ where: { scheduleId } })
    await prisma.schedule.delete({ where: { id: scheduleId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
