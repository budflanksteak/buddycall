"use client"
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isToday, isSameDay, addMonths, subMonths, isSaturday, isSunday, addDays,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X, Trash2, Loader2 } from 'lucide-react'
import { getFederalHolidays } from '@/lib/utils'

type BlockedDate = { id: string; date: string; reason?: string }
type Assignment = { id: string; date: string; dayType: string; assignmentType: string; primaryUserId: string }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selected, setSelected] = useState<Date[]>([])
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadData = useCallback(async () => {
    const [blockedRes, assignRes] = await Promise.all([
      fetch('/api/blocked-dates'),
      fetch('/api/schedule'),
    ])
    const blocked = await blockedRes.json()
    const assign = await assignRes.json()
    setBlockedDates(Array.isArray(blocked) ? blocked : [])
    setAssignments(Array.isArray(assign) ? assign : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated') loadData()
  }, [status, loadData])

  const isBlocked = (date: Date) =>
    blockedDates.some(b => isSameDay(new Date(b.date), date))

  const isAssigned = (date: Date) =>
    assignments.some(a => isSameDay(new Date(a.date), date))

  const isSelected = (date: Date) =>
    selected.some(s => isSameDay(s, date))

  const isWeekendOrHoliday = (date: Date) => {
    if (isSaturday(date) || isSunday(date)) return true
    const year = date.getFullYear()
    const holidays = getFederalHolidays(year).map(h => h.date)
    return holidays.some(h => isSameDay(h, date))
  }

  function toggleDate(date: Date) {
    if (!isWeekendOrHoliday(date)) {
      toast({ title: 'Only weekends and holidays can be blocked', variant: 'destructive' })
      return
    }
    if (isAssigned(date)) {
      toast({ title: 'You are already assigned this date', variant: 'destructive' })
      return
    }
    setSelected(prev =>
      prev.some(s => isSameDay(s, date))
        ? prev.filter(s => !isSameDay(s, date))
        : [...prev, date]
    )
  }

  async function saveBlocked() {
    if (selected.length === 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/blocked-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dates: selected.map(d => format(d, 'yyyy-MM-dd')),
          reason: reason || undefined,
        }),
      })
      if (res.ok) {
        toast({ title: `${selected.length} date(s) blocked`, variant: 'success' as any })
        setSelected([])
        setReason('')
        await loadData()
      }
    } finally {
      setSaving(false)
    }
  }

  async function removeBlocked(dateStr: string) {
    const res = await fetch('/api/blocked-dates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates: [dateStr] }),
    })
    if (res.ok) {
      toast({ title: 'Date unblocked' })
      await loadData()
    }
  }

  const calendarDays = (() => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    const days = eachDayOfInterval({ start, end })
    const startPad = start.getDay()
    const padded: (Date | null)[] = [...Array(startPad).fill(null), ...days]
    while (padded.length % 7 !== 0) padded.push(null)
    return padded
  })()

  const holidays = getFederalHolidays(currentMonth.getFullYear())
  const holidayDates = holidays.map(h => h.date)

  function getDayClass(date: Date | null) {
    if (!date) return ''
    const base = 'h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-all relative'
    if (!isSameMonth(date, currentMonth)) return `${base} text-gray-300`
    if (isAssigned(date)) return `${base} bg-blue-200 text-blue-800 cursor-not-allowed ring-2 ring-blue-400`
    if (isBlocked(date)) return `${base} bg-red-100 text-red-700 ring-2 ring-red-300 cursor-pointer hover:bg-red-200`
    if (isSelected(date)) return `${base} bg-blue-600 text-white hover:bg-blue-700`
    if (!isWeekendOrHoliday(date)) return `${base} text-gray-400 cursor-default`
    if (isToday(date)) return `${base} ring-2 ring-blue-400 text-blue-700 hover:bg-blue-100`
    if (isSaturday(date) || isSunday(date)) return `${base} text-gray-800 hover:bg-gray-100`
    // holiday
    return `${base} text-amber-700 hover:bg-amber-50`
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">My Availability Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Block out weekends and holidays when you are unavailable. These are saved permanently.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h2 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
                  <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Day labels */}
                <div className="grid grid-cols-7 mb-2">
                  {WEEKDAYS.map(d => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                      {d}
                    </div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, i) => {
                    if (!date) return <div key={i} className="h-10 w-10" />
                    const isHol = holidayDates.some(h => isSameDay(h, date))
                    const holName = isHol ? holidays.find(h => isSameDay(h.date, date))?.name : null
                    return (
                      <div key={i} className="flex justify-center">
                        <div
                          className={getDayClass(date)}
                          onClick={() => !isAssigned(date) && isSameMonth(date, currentMonth) && toggleDate(date)}
                          title={holName || undefined}
                        >
                          {format(date, 'd')}
                          {isHol && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full" />}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-600" /> Selected
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-red-200 ring-1 ring-red-300" /> Blocked
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-blue-200 ring-1 ring-blue-400" /> Assigned
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-3 w-3 rounded-full bg-amber-500" /> Holiday
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Selection panel */}
            {selected.length > 0 && (
              <Card className="mt-4 border-blue-200 bg-blue-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{selected.length} date(s) selected</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selected.sort((a, b) => a.getTime() - b.getTime()).map(d => (
                      <Badge key={d.toISOString()} variant="secondary" className="gap-1">
                        {format(d, 'MMM d')}
                        <button onClick={() => setSelected(prev => prev.filter(s => !isSameDay(s, d)))}>
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="reason" className="text-xs">Reason (optional)</Label>
                    <Input
                      id="reason"
                      placeholder="e.g. Vacation, Conference, Family event..."
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveBlocked} disabled={saving}>
                      {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                      Block These Dates
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSelected([])}>
                      Clear
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Blocked dates list */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Blocked Dates</CardTitle>
                <CardDescription>{blockedDates.length} date(s) blocked</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedDates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No blocked dates yet.<br />Click weekend or holiday dates to block them.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {blockedDates
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .map(b => (
                        <div key={b.id} className="flex items-center justify-between p-2 bg-red-50 rounded border border-red-100">
                          <div>
                            <p className="text-sm font-medium">{format(new Date(b.date), 'EEE, MMM d, yyyy')}</p>
                            {b.reason && <p className="text-xs text-muted-foreground">{b.reason}</p>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-100"
                            onClick={() => removeBlocked(format(new Date(b.date), 'yyyy-MM-dd'))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))
                    }
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
