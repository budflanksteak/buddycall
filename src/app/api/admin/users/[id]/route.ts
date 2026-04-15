import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const schema = z.object({
  callType: z.enum(['loner', 'buddy']),
  weekendPreference: z.enum(['full', 'single']),
  holidayPreference: z.enum(['with-weekend', 'separate']),
  fte: z.number().min(0.1).max(1.0),
  spacingPreference: z.enum(['maximize', 'no-preference']),
  blockedHolidays: z.array(z.string()).optional(),
})

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
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
      where: { id: params.id },
      data: {
        ...rest,
        blockedHolidays: JSON.stringify(blockedHolidays ?? []),
        profileComplete: true,
      },
    })

    return NextResponse.json({ success: true, user })
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
