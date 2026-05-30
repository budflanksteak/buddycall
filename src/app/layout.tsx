import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SessionProvider } from 'next-auth/react'
import { Footer } from '@/components/footer'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Neurorad Call Autopilot',
  description: 'Neuroradiology Weekend Call Scheduling System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <SessionProvider>
          <div className="flex flex-col flex-1">
            {children}
          </div>
          <Footer />
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}
