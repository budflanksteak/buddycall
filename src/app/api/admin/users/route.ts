import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      callType: true,
      weekendPreference: true,
      holidayPreference: true,
      fte: true,
      spacingPreference: true,
      profileComplete: true,
      isActive: true,
      createdAt: true,
      _count: {
        select: {
          primaryAssignments: true,
          buddyAssignments: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(users)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId, isActive, role } = await req.json()
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const data: any = {}
    if (isActive !== undefined) data.isActive = isActive
    if (role !== undefined) data.role = role

    const user = await prisma.user.update({
      where: { id: userId },
      data,
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
