import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Admin: view all faculty blocked dates
export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dates = await prisma.blockedDate.findMany({
    include: {
      user: { select: { name: true, email: true } },
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(dates)
}
