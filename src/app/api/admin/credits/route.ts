import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getAcademicYear } from '@/lib/utils'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const year = url.searchParams.get('year') || getAcademicYear(new Date())

  const credits = await prisma.creditLog.findMany({
    where: { academicYear: year },
    include: {
      user: { select: { name: true, email: true, callType: true, fte: true } },
    },
    orderBy: { workloadUnits: 'desc' },
  })

  // Get all available academic years
  const allYears = await prisma.creditLog.findMany({
    select: { academicYear: true },
    distinct: ['academicYear'],
    orderBy: { academicYear: 'desc' },
  })

  return NextResponse.json({ credits, availableYears: allYears.map(y => y.academicYear), currentYear: year })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { year } = await req.json()
  if (!year) return NextResponse.json({ error: 'year required' }, { status: 400 })

  await prisma.creditLog.deleteMany({ where: { academicYear: year } })
  return NextResponse.json({ success: true })
}
