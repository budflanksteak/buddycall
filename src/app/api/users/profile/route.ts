import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2).optional(),
  callType: z.enum(['loner', 'buddy']),
  weekendPreference: z.enum(['full', 'single']),
  holidayPreference: z.enum(['with-weekend', 'separate']),
  fte: z.number().min(0.1).max(1.0),
  spacingPreference: z.enum(['maximize', 'no-preference']),
  blockedHolidays: z.array(z.string()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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
      blockedHolidays: true,
      profileComplete: true,
      isActive: true,
    },
  })

  return NextResponse.json(user)
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { blockedHolidays, ...rest } = parsed.data
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...rest,
        blockedHolidays: JSON.stringify(blockedHolidays ?? []),
        profileComplete: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
