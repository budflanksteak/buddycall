"use client"
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { format, isFuture, isPast } from 'date-fns'
import Link from 'next/link'

type Assignment = {
  id: string
  date: string
  dayType: string
  assignmentType: string
  primaryUserId: string
  buddyUserId?: string
  primaryUser: { name: string; email: string }
  buddyUser?: { name: string; email: string }
  schedule: { name: string }
}

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    // Check profileComplete from API (not JWT) so it reflects DB state immediately
    fetch('/api/users/profile')
      .then(r => r.json())
      .then(profile => {
        if (!profile || profile.error || !profile.profileComplete) {
          router.push('/profile')
        } else {
          return fetch('/api/schedule')
            .then(r => r.json())
            .then(data => setAssignments(Array.isArray(data) ? data : []))
        }
      })
      .catch(() => router.push('/profile'))
      .finally(() => setLoading(false))
  }, [status, router])

  if (status === 'loading' || (status === 'authenticated' && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) return null

  const upcoming = assignments
    .filter(a => isFuture(new Date(a.date)))
    .slice(0, 5)

  const past = assignments
    .filter(a => isPast(new Date(a.date)))
    .slice(-3)
    .reverse()

  const primaryCount = assignments.filter(a => a.primaryUserId === session.user.id).length
  const buddyCount = assignments.filter(a => a.buddyUserId === session.user.id).length
  const holidayCount = assignments.filter(a => a.dayType === 'holiday').length
  const totalUpcoming = upcoming.length

  function getDayTypeBadge(dayType: string) {
    if (dayType === 'holiday') return <Badge variant="warning">Holiday</Badge>
    if (dayType === 'saturday') return <Badge variant="info">Saturday</Badge>
    if (dayType === 'sunday') return <Badge variant="secondary">Sunday</Badge>
    return <Badge>{dayType}</Badge>
  }

  function getRoleBadge(a: Assignment) {
    if (a.primaryUserId === session?.user.id) {
      return <Badge variant="default">Primary</Badge>
    }
    return <Badge variant="success">Buddy</Badge>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome banner */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {session.user.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Your call schedule overview
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-blue-100 rounded-lg p-2">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUpcoming}</p>
                <p className="text-xs text-muted-foreground">Upcoming</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-indigo-100 rounded-lg p-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{primaryCount}</p>
                <p className="text-xs text-muted-foreground">Primary Days</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-green-100 rounded-lg p-2">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{buddyCount}</p>
                <p className="text-xs text-muted-foreground">Buddy Days</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-yellow-100 rounded-lg p-2">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{holidayCount}</p>
                <p className="text-xs text-muted-foreground">Holidays</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Upcoming assignments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Upcoming Call Days</CardTitle>
                <CardDescription>Your next scheduled assignments</CardDescription>
              </div>
              <Link href="/calendar">
                <Button variant="outline" size="sm">View Calendar</Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcoming.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>No upcoming assignments</p>
                  <p className="text-xs mt-1">Schedule hasn't been published yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcoming.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                      <div>
                        <p className="font-semibold text-sm">{format(new Date(a.date), 'EEEE, MMMM d, yyyy')}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getDayTypeBadge(a.dayType)}
                          {getRoleBadge(a)}
                        </div>
                        {a.buddyUser && a.primaryUserId === session.user.id && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Buddy: {a.buddyUser.name}
                          </p>
                        )}
                        {a.primaryUser && a.buddyUserId === session.user.id && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Primary: {a.primaryUser.name}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{a.schedule.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Profile & quick actions */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Call Type</span>
                    <div className="font-medium capitalize mt-0.5">{session.user.callType || 'Not set'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Role</span>
                    <div className="font-medium capitalize mt-0.5">{session.user.role}</div>
                  </div>
                </div>
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    Edit Preferences
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/calendar" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Calendar className="h-4 w-4" />
                    Manage Blocked Dates
                  </Button>
                </Link>
                <Link href="/profile" className="block">
                  <Button variant="outline" className="w-full justify-start gap-2">
                    <Users className="h-4 w-4" />
                    Update Call Preferences
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {past.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold text-muted-foreground">Recent Call History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {past.map(a => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{format(new Date(a.date), 'MMM d, yyyy')}</span>
                      <div className="flex gap-1">
                        {getDayTypeBadge(a.dayType)}
                        {getRoleBadge(a)}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
