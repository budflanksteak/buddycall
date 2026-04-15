"use client"
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LayoutDashboard, Calendar, User, Settings, LogOut, Brain, Shield,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function Navbar() {
  const { data: session } = useSession()
  const pathname = usePathname()

  if (!session) return null

  const isAdmin = session.user.role === 'admin'

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/calendar', label: 'My Calendar', icon: Calendar },
    { href: '/profile', label: 'Profile', icon: User },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: Shield }] : []),
  ]

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <Brain className="h-7 w-7 text-blue-600" />
            <span className="font-bold text-xl text-blue-900">Neurorad AutoPilot</span>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(link => {
              const Icon = link.icon
              const active = pathname.startsWith(link.href)
              return (
                <Link key={link.href} href={link.href}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* User info + logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium">{session.user.name}</span>
              <div className="flex items-center gap-1">
                {isAdmin && <Badge variant="info" className="text-xs">Admin</Badge>}
                {session.user.callType && (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {session.user.callType}
                  </Badge>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex gap-1 pb-2 overflow-x-auto">
          {navLinks.map(link => {
            const Icon = link.icon
            const active = pathname.startsWith(link.href)
            return (
              <Link key={link.href} href={link.href}>
                <Button variant={active ? 'default' : 'ghost'} size="sm" className="gap-1 whitespace-nowrap">
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
