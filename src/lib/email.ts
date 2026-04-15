import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_SERVER_HOST,
  port: Number(process.env.EMAIL_SERVER_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
})

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Reset your Neurorad AutoPilot password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Neurorad AutoPilot</h2>
        <p>Hi ${name},</p>
        <p>You requested a password reset. Click the button below to reset your password:</p>
        <a href="${resetUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">Reset Password</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <hr />
        <p style="color: #6b7280; font-size: 12px;">Neurorad AutoPilot - Radiology Call Scheduling System</p>
      </div>
    `,
  })
}

export async function sendVerificationEmail(email: string, name: string, verifyUrl: string) {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Verify your Neurorad AutoPilot account',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1e40af;">Welcome to Neurorad AutoPilot!</h2>
        <p>Hi ${name},</p>
        <p>Please verify your email address to activate your account:</p>
        <a href="${verifyUrl}" style="display: inline-block; background-color: #1e40af; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin: 16px 0;">Verify Email</a>
        <p>This link expires in 24 hours.</p>
        <hr />
        <p style="color: #6b7280; font-size: 12px;">Neurorad AutoPilot - Radiology Call Scheduling System</p>
      </div>
    `,
  })
}
