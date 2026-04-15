import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  try {
    const { token } = await req.json()
    if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const verifyToken = await prisma.emailVerificationToken.findUnique({
      where: { token },
    })

    if (!verifyToken || verifyToken.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: verifyToken.userId },
      data: { emailVerified: new Date() },
    })

    await prisma.emailVerificationToken.delete({ where: { id: verifyToken.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
