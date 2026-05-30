import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const requestedUserId = url.searchParams.get('userId')
  const targetUserId = (session.user.role === 'admin' && requestedUserId)
    ? requestedUserId
    : session.user.id

  // Get published schedules with user's assignments
  const assignments = await prisma.callAssignment.findMany({
    where: {
      OR: [
        { primaryUserId: targetUserId },
        { buddyUserId: targetUserId },
      ],
      schedule: { status: 'published' },
    },
    include: {
      primaryUser: { select: { name: true, email: true } },
      buddyUser: { select: { name: true, email: true } },
      schedule: { select: { name: true, startDate: true, endDate: true } },
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(assignments)
}
