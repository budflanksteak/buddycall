import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { token, password } = await req.json()
    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password required' }, { status: 400 })
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!resetToken || resetToken.used || resetToken.expires < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    await prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashed },
    })

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
