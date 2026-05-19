import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url    = new URL(req.url)
  const userId = url.searchParams.get('userId') ?? undefined

  const logs = await prisma.qgendaLog.findMany({
    where: userId ? { userId } : {},
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

  return NextResponse.json({ logs, summary })
}
