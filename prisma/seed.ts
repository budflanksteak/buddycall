import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@neurorad.edu' },
    update: {},
    create: {
      name: 'Dr. Admin',
      email: 'admin@neurorad.edu',
      password: adminPassword,
      role: 'admin',
      callType: 'loner',
      weekendPreference: 'full',
      holidayPreference: 'separate',
      fte: 1.0,
      spacingPreference: 'maximize',
      profileComplete: true,
      emailVerified: new Date(),
    },
  })

  console.log('Created admin:', admin.email)

  // Create sample faculty
  const faculty = [
    { name: 'Dr. Alice Chen', callType: 'buddy', fte: 1.0 },
    { name: 'Dr. Bob Martinez', callType: 'buddy', fte: 1.0 },
    { name: 'Dr. Carol Johnson', callType: 'loner', fte: 1.0 },
    { name: 'Dr. David Lee', callType: 'loner', fte: 0.5 },
    { name: 'Dr. Emma Wilson', callType: 'buddy', fte: 1.0 },
    { name: 'Dr. Frank Brown', callType: 'buddy', fte: 1.0 },
  ]

  for (let i = 0; i < faculty.length; i++) {
    const f = faculty[i]
    const password = await bcrypt.hash('faculty123!', 12)
    const emailBase = f.name.toLowerCase().replace(/dr\. /, '').replace(' ', '.')
    await prisma.user.upsert({
      where: { email: `${emailBase}@neurorad.edu` },
      update: {},
      create: {
        name: f.name,
        email: `${emailBase}@neurorad.edu`,
        password,
        role: 'faculty',
        callType: f.callType,
        weekendPreference: i % 2 === 0 ? 'full' : 'single',
        holidayPreference: i % 3 === 0 ? 'with-weekend' : 'separate',
        fte: f.fte,
        spacingPreference: i % 2 === 0 ? 'maximize' : 'no-preference',
        profileComplete: true,
        emailVerified: new Date(),
      },
    })
    console.log(`Created faculty: ${emailBase}@neurorad.edu`)
  }

  console.log('Seeding complete!')
  console.log('\nAdmin login: admin@neurorad.edu / admin123!')
  console.log('Faculty login: alice.chen@neurorad.edu / faculty123! (etc.)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
