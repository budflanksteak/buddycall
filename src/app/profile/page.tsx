"use client"
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle, User, Users, UserCheck } from 'lucide-react'

const FEDERAL_HOLIDAYS = [
  "New Year's Day",
  "Martin Luther King Jr. Day",
  "Presidents' Day",
  "Memorial Day",
  "Juneteenth",
  "Independence Day",
  "Labor Day",
  "Columbus Day",
  "Veterans Day",
  "Thanksgiving Day",
  "Christmas Day",
]

type Profile = {
  callType: string | null
  weekendPreference: string | null
  holidayPreference: string | null
  fte: number
  spacingPreference: string | null
  blockedHolidays: string
  name: string | null
  email: string
  role: string
  profileComplete: boolean
}

function OptionCard({
  selected, onClick, title, description, icon: Icon
}: {
  selected: boolean, onClick: () => void, title: string, description: string, icon?: any
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
        selected
          ? 'border-blue-600 bg-blue-50'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={`rounded-md p-1.5 mt-0.5 ${selected ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Icon className={`h-4 w-4 ${selected ? 'text-blue-600' : 'text-gray-500'}`} />
          </div>
        )}
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
        </div>
        {selected && <CheckCircle className="h-4 w-4 text-blue-600 ml-auto mt-0.5 shrink-0" />}
      </div>
    </button>
  )
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [callType, setCallType] = useState<string>('')
  const [weekendPreference, setWeekendPreference] = useState<string>('')
  const [holidayPreference, setHolidayPreference] = useState<string>('')
  const [fte, setFte] = useState<number>(1.0)
  const [spacingPreference, setSpacingPreference] = useState<string>('')
  const [blockedHolidays, setBlockedHolidays] = useState<string[]>([])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated') {
      fetch('/api/users/profile')
        .then(r => r.json())
        .then((data: Profile) => {
          if (data.callType) setCallType(data.callType)
          if (data.weekendPreference) setWeekendPreference(data.weekendPreference)
          if (data.holidayPreference) setHolidayPreference(data.holidayPreference)
          if (data.fte) setFte(data.fte)
          if (data.spacingPreference) setSpacingPreference(data.spacingPreference)
          if (data.blockedHolidays) {
            try { setBlockedHolidays(JSON.parse(data.blockedHolidays)) } catch {}
          }
        })
        .finally(() => setLoading(false))
    }
  }, [status, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!callType || !weekendPreference || !holidayPreference || !spacingPreference) {
      toast({ title: 'Please complete all preferences', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType, weekendPreference, holidayPreference, fte, spacingPreference, blockedHolidays }),
      })
      if (res.ok) {
        toast({ title: 'Profile saved!' })
        // Hard redirect so the session JWT is fully refreshed from the server
        window.location.href = '/dashboard'
      } else {
        const d = await res.json()
        toast({ title: 'Save failed', description: JSON.stringify(d.error), variant: 'destructive' })
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const isFirstSetup = !session?.user.profileComplete

  return (
    <div className="min-h-screen bg-gray-50">
      {!isFirstSetup && <Navbar />}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {isFirstSetup && (
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-blue-900">Welcome to Neurorad AutoPilot</h1>
            <p className="text-muted-foreground mt-2">
              Please complete your profile to get started. This helps us build an equitable call schedule.
            </p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Call Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Call Type</CardTitle>
              <CardDescription>
                How do you take call? Loners work independently; Buddies are always paired with a partner.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={callType === 'loner'}
                onClick={() => setCallType('loner')}
                icon={User}
                title="Loner"
                description="I take call independently. Assigned primary responsibility only."
              />
              <OptionCard
                selected={callType === 'buddy'}
                onClick={() => setCallType('buddy')}
                icon={Users}
                title="Buddy"
                description="I always work paired with a partner — both primary and buddy assignments."
              />
            </CardContent>
          </Card>

          {/* Weekend Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Weekend Preference</CardTitle>
              <CardDescription>
                Do you prefer to cover an entire weekend (Sat + Sun) or just one day per weekend?
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={weekendPreference === 'full'}
                onClick={() => setWeekendPreference('full')}
                title="Full Weekend"
                description="Assign me both Saturday AND Sunday together as one block."
              />
              <OptionCard
                selected={weekendPreference === 'single'}
                onClick={() => setWeekendPreference('single')}
                title="Single Day"
                description="Assign me one day per weekend — either Saturday or Sunday, not both."
              />
            </CardContent>
          </Card>

          {/* Holiday Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Holiday Preference</CardTitle>
              <CardDescription>
                When a holiday falls adjacent to a weekend, do you prefer to work all days together or keep holidays separate?
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={holidayPreference === 'with-weekend'}
                onClick={() => setHolidayPreference('with-weekend')}
                title="Include with Weekend"
                description="Work all consecutive days (e.g., Sat + Sun + Mon holiday) as one stretch."
              />
              <OptionCard
                selected={holidayPreference === 'separate'}
                onClick={() => setHolidayPreference('separate')}
                title="Holidays Separate"
                description="Keep holiday assignments separate from weekend assignments."
              />
            </CardContent>
          </Card>

          {/* FTE */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">FTE (Full-Time Equivalent)</CardTitle>
              <CardDescription>
                Part-time faculty receive proportionally fewer call assignments. 1.0 = full-time, 0.5 = half-time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.1"
                  value={fte}
                  onChange={e => setFte(parseFloat(e.target.value))}
                  className="flex-1 h-2 accent-blue-600"
                />
                <div className="text-center">
                  <span className="text-2xl font-bold text-blue-600">{fte.toFixed(1)}</span>
                  <p className="text-xs text-muted-foreground">FTE</p>
                </div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0.1 (10%)</span>
                <span>0.5 (50%)</span>
                <span>1.0 (100%)</span>
              </div>
              {fte < 1.0 && (
                <p className="text-sm text-blue-700 bg-blue-50 rounded p-2">
                  At {(fte * 100).toFixed(0)}% FTE, you'll be assigned approximately {(fte * 100).toFixed(0)}% of a full-time faculty member's call.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Spacing Preference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Assignment Spacing</CardTitle>
              <CardDescription>
                How much space between your call assignments matters to you?
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={spacingPreference === 'maximize'}
                onClick={() => setSpacingPreference('maximize')}
                title="Maximize Spacing"
                description="I prefer as much time between assignments as possible."
              />
              <OptionCard
                selected={spacingPreference === 'no-preference'}
                onClick={() => setSpacingPreference('no-preference')}
                title="No Preference"
                description="I don't mind working adjacent weekends or consecutive dates."
              />
            </CardContent>
          </Card>

          {/* Permanently Blocked Holidays */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Always-Blocked Holidays</CardTitle>
              <CardDescription>
                Select holidays you never want to be assigned, regardless of the schedule period.
                These are applied automatically every year.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {FEDERAL_HOLIDAYS.map(holiday => {
                  const checked = blockedHolidays.includes(holiday)
                  return (
                    <button
                      key={holiday}
                      type="button"
                      onClick={() =>
                        setBlockedHolidays(prev =>
                          checked ? prev.filter(h => h !== holiday) : [...prev, holiday]
                        )
                      }
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                        checked
                          ? 'border-red-400 bg-red-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        checked ? 'border-red-500 bg-red-500' : 'border-gray-300'
                      }`}>
                        {checked && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-sm font-medium">{holiday}</span>
                    </button>
                  )
                })}
              </div>
              {blockedHolidays.length > 0 && (
                <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-100 rounded p-2">
                  {blockedHolidays.length} holiday{blockedHolidays.length > 1 ? 's' : ''} permanently blocked:
                  {' '}{blockedHolidays.join(', ')}
                </p>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" className="w-full" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFirstSetup ? 'Complete Setup & Continue' : 'Save Preferences'}
          </Button>
        </form>
      </main>
    </div>
  )
}
