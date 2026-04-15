import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'
import { sendVerificationEmail } from '@/lib/email'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)

    // Check if this is the first user - make them admin
    const userCount = await prisma.user.count()
    const role = userCount === 0 ? 'admin' : 'faculty'

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        role,
        emailVerified: new Date(), // auto-verify; email sending is optional
      },
    })

    // Attempt to send welcome email only if real SMTP creds are present
    const smtpUser = process.env.EMAIL_SERVER_USER || ''
    const smtpPass = process.env.EMAIL_SERVER_PASSWORD || ''
    const realSmtp = smtpUser.length > 0 &&
      !smtpUser.includes('your-email') &&
      smtpPass.length > 0 &&
      !smtpPass.includes('your-app-password')

    if (realSmtp) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
        await sendVerificationEmail(email, name, baseUrl + '/login')
      } catch (e) {
        console.error('Welcome email failed (non-fatal):', e)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. You can now sign in.',
      isFirstUser: role === 'admin',
    })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
