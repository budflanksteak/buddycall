import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { faculty } = await req.json()
    // faculty: Array<{ name: string; email: string }>

    if (!Array.isArray(faculty) || faculty.length === 0) {
      return NextResponse.json({ error: 'No faculty provided' }, { status: 400 })
    }

    const results: { name: string; email: string; status: string; tempPassword: string }[] = []

    for (const f of faculty) {
      if (!f.name || !f.email) continue

      const existing = await prisma.user.findUnique({ where: { email: f.email } })
      if (existing) {
        results.push({ name: f.name, email: f.email, status: 'already exists', tempPassword: '' })
        continue
      }

      // Default password = last name (lowercase)
      const lastName = f.name.trim().split(' ').pop() || 'password'
      const tempPassword = lastName.toLowerCase()
      const hashed = await bcrypt.hash(tempPassword, 12)

      await prisma.user.create({
        data: {
          name: f.name.trim(),
          email: f.email.trim().toLowerCase(),
          password: hashed,
          role: 'faculty',
          emailVerified: new Date(),
        },
      })

      results.push({ name: f.name, email: f.email, status: 'created', tempPassword })
    }

    return NextResponse.json({ success: true, results })
  } catch (error) {
    console.error('Import faculty error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
