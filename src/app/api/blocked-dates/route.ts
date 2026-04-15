import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dates = await prisma.blockedDate.findMany({
    where: { userId: session.user.id },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json(dates)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { dates, reason } = await req.json()
    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: 'dates must be an array' }, { status: 400 })
    }

    const created = await Promise.all(
      dates.map(async (dateStr: string) => {
        const date = new Date(dateStr)
        date.setUTCHours(12, 0, 0, 0) // Normalize to noon UTC to avoid timezone issues
        return prisma.blockedDate.upsert({
          where: { userId_date: { userId: session.user.id, date } },
          update: { reason },
          create: { userId: session.user.id, date, reason },
        })
      })
    )

    return NextResponse.json({ success: true, created })
  } catch (error) {
    console.error('Blocked dates POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { dates } = await req.json()
    if (!Array.isArray(dates)) {
      return NextResponse.json({ error: 'dates must be an array' }, { status: 400 })
    }

    for (const dateStr of dates) {
      const date = new Date(dateStr)
      date.setUTCHours(12, 0, 0, 0)
      await prisma.blockedDate.deleteMany({
        where: { userId: session.user.id, date },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Blocked dates DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
