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
  Users, Calendar, Download, RefreshCw, Play, Trash2, CheckCircle,
  AlertTriangle, TrendingUp, Shield, ChevronDown, ChevronUp, Loader2,
  FileSpreadsheet, ClipboardList, UserPlus, Plus, X, Copy, Pencil, BookOpen,
} from 'lucide-react'

const FEDERAL_HOLIDAYS = [
  "New Year's Day", "Martin Luther King Jr. Day", "Presidents' Day",
  "Memorial Day", "Juneteenth", "Independence Day", "Labor Day",
  "Columbus Day", "Veterans Day", "Thanksgiving Day", "Christmas Day",
]
import { format } from 'date-fns'

type User = {
  id: string; name: string | null; email: string; role: string
  callType: string | null; weekendPreference: string | null; holidayPreference: string | null
  fte: number; spacingPreference: string | null; profileComplete: boolean; isActive: boolean
  _count: { primaryAssignments: number; buddyAssignments: number }
}

type Schedule = {
  id: string; name: string; startDate: string; endDate: string
  status: string; createdAt: string; _count: { assignments: number }
}

type AssignmentResult = {
  stats: {
    totalDays: number; assignedDays: number; unassignedDays: number; score: number; warnings: string[]
    userStats: Array<{
      userId: string; name: string; callType: string
      primaryDays: number; buddyDays: number; holidays: number
      workloadUnits: number; targetPrimaryDays: number; primaryBalance: number
    }>
  }
}

type ScheduleDetail = {
  id: string; name: string; startDate: string; endDate: string; status: string
  assignments: Array<{
    id: string; date: string; dayType: string
    primaryUser: { id: string; name: string | null; email: string } | null
    buddyUser: { id: string; name: string | null; email: string } | null
  }>
}

type ImportResult = { name: string; email: string; status: string; tempPassword: string }
type CreditEntry = {
  id: string; userId: string; academicYear: string
  primaryDays: number; buddyDays: number; holidayDays: number; workloadUnits: number
  user: { name: string | null; email: string; callType: string | null; fte: number }
}
type TabType = 'faculty' | 'import' | 'schedules' | 'create' | 'view' | 'credits'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [tab, setTab] = useState<TabType>('faculty')
  const [users, setUsers] = useState<User[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleDetail | null>(null)
  const [lastResult, setLastResult] = useState<AssignmentResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importRows, setImportRows] = useState([{ name: '', email: '' }])
  const [importResults, setImportResults] = useState<ImportResult[]>([])

  // Credit log
  const [credits, setCredits] = useState<CreditEntry[]>([])
  const [creditYear, setCreditYear] = useState('')
  const [availableYears, setAvailableYears] = useState<string[]>([])

  async function loadCredits(year?: string) {
    const url = year ? `/api/admin/credits?year=${year}` : '/api/admin/credits'
    const res = await fetch(url)
    const data = await res.json()
    setCredits(data.credits || [])
    setAvailableYears(data.availableYears || [])
    setCreditYear(data.currentYear || '')
  }

  // Edit individual assignment modal
  type EditingAssignment = {
    id: string; date: string; dayType: string
    primaryUserId: string; buddyUserId: string
  }
  const [editingAssignment, setEditingAssignment] = useState<EditingAssignment | null>(null)
  const [savingAssignment, setSavingAssignment] = useState(false)

  // Edit faculty preferences modal
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    callType: 'loner',
    weekendPreference: 'full',
    holidayPreference: 'separate',
    fte: 1.0,
    spacingPreference: 'no-preference',
    blockedHolidays: [] as string[],
  })
  const [savingEdit, setSavingEdit] = useState(false)

  // New schedule form
  const [newName, setNewName] = useState('')
  const [newStart, setNewStart] = useState('')
  const [newEnd, setNewEnd] = useState('')
  const [spanPreset, setSpanPreset] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/login'); return }
    if (status === 'authenticated' && session.user.role !== 'admin') { router.push('/dashboard') }
  }, [status, session, router])

  const loadData = useCallback(async () => {
    const [usersRes, schedsRes] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/schedule'),
    ])
    const usersData = await usersRes.json()
    const schedsData = await schedsRes.json()
    setUsers(Array.isArray(usersData) ? usersData : [])
    setSchedules(Array.isArray(schedsData) ? schedsData : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user.role === 'admin') loadData()
  }, [status, session, loadData])

  function applySpanPreset(preset: string) {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    let end: Date
    let name = ''

    if (preset === 'year') {
      end = new Date(today.getFullYear(), 11, 31)
      name = `${today.getFullYear()} Annual Schedule`
    } else if (preset === 'half') {
      if (today.getMonth() < 6) {
        end = new Date(today.getFullYear(), 5, 30)
        name = `${today.getFullYear()} H1 Schedule`
      } else {
        end = new Date(today.getFullYear(), 11, 31)
        name = `${today.getFullYear()} H2 Schedule`
      }
    } else if (preset === 'quarter') {
      const q = Math.floor(today.getMonth() / 3)
      const qEnd = [2, 5, 8, 11][q]
      const lastDay = new Date(today.getFullYear(), qEnd + 1, 0).getDate()
      end = new Date(today.getFullYear(), qEnd, lastDay)
      name = `${today.getFullYear()} Q${q + 1} Schedule`
    } else {
      return
    }

    setNewStart(format(start, 'yyyy-MM-dd'))
    setNewEnd(format(end, 'yyyy-MM-dd'))
    setNewName(name)
    setSpanPreset(preset)
  }

  function openEdit(user: User) {
    setEditingUser(user)
    setEditForm({
      callType: user.callType || 'loner',
      weekendPreference: user.weekendPreference || 'full',
      holidayPreference: user.holidayPreference || 'separate',
      fte: user.fte,
      spacingPreference: user.spacingPreference || 'no-preference',
      blockedHolidays: [],
    })
  }

  async function saveEdit() {
    if (!editingUser) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (res.ok) {
        toast({ title: `${editingUser.name}'s preferences saved` })
        setEditingUser(null)
        await loadData()
      } else {
        toast({ title: 'Save failed', variant: 'destructive' })
      }
    } finally {
      setSavingEdit(false)
    }
  }

  async function importFaculty() {
    const valid = importRows.filter(r => r.name.trim() && r.email.trim())
    if (valid.length === 0) {
      toast({ title: 'Add at least one faculty member', variant: 'destructive' })
      return
    }
    setImporting(true)
    try {
      const res = await fetch('/api/admin/import-faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty: valid }),
      })
      const data = await res.json()
      if (res.ok) {
        setImportResults(data.results)
        toast({ title: `${data.results.filter((r: ImportResult) => r.status === 'created').length} account(s) created` })
        await loadData()
      }
    } finally {
      setImporting(false)
    }
  }

  async function createSchedule() {
    if (!newName || !newStart || !newEnd) {
      toast({ title: 'Fill in all fields', variant: 'destructive' })
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, startDate: newStart, endDate: newEnd }),
      })
      const data = await res.json()
      if (res.ok) {
        setLastResult(data.result)
        toast({ title: 'Schedule created!', description: `Equity score: ${data.result.stats.score}/100` })
        setTab('schedules')
        await loadData()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } finally {
      setCreating(false)
    }
  }

  async function reassignSchedule(scheduleId: string) {
    setReassigning(true)
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId, action: 'reassign' }),
      })
      const data = await res.json()
      if (res.ok) {
        setLastResult(data.result)
        setTab('schedules')
        toast({ title: 'Re-assigned!', description: `New equity score: ${data.result.stats.score}/100` })
        await loadData()
      }
    } finally {
      setReassigning(false)
    }
  }

  async function publishSchedule(scheduleId: string) {
    const res = await fetch('/api/admin/schedule', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId, action: 'publish' }),
    })
    if (res.ok) {
      toast({ title: 'Schedule published!' })
      await loadData()
    }
  }

  async function deleteSchedule(scheduleId: string) {
    if (!confirm('Delete this schedule and all its assignments?')) return
    await fetch('/api/admin/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduleId }),
    })
    toast({ title: 'Schedule deleted' })
    await loadData()
  }

  async function viewSchedule(scheduleId: string) {
    const res = await fetch(`/api/admin/schedule/${scheduleId}`)
    const data = await res.json()
    setSelectedSchedule(data)
    setTab('view')
  }

  function openAssignmentEdit(a: ScheduleDetail['assignments'][number]) {
    setEditingAssignment({
      id: a.id,
      date: a.date,
      dayType: a.dayType,
      primaryUserId: a.primaryUser?.id ?? '',
      buddyUserId: a.buddyUser?.id ?? '',
    })
  }

  async function saveAssignment() {
    if (!editingAssignment || !selectedSchedule) return
    setSavingAssignment(true)
    try {
      const res = await fetch(`/api/admin/schedule/${selectedSchedule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: editingAssignment.id,
          primaryUserId: editingAssignment.primaryUserId,
          buddyUserId: editingAssignment.buddyUserId,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        // Patch the local schedule state so the table updates immediately
        setSelectedSchedule(prev => prev ? {
          ...prev,
          assignments: prev.assignments.map(a =>
            a.id === updated.id ? updated : a
          ),
        } : prev)
        setEditingAssignment(null)
        toast({ title: 'Assignment updated' })
      } else {
        const d = await res.json()
        toast({ title: 'Save failed', description: d.error, variant: 'destructive' })
      }
    } finally {
      setSavingAssignment(false)
    }
  }

  async function toggleUserActive(userId: string, isActive: boolean) {
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, isActive }),
    })
    await loadData()
  }

  async function toggleUserRole(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'faculty' : 'admin'
    await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole }),
    })
    toast({ title: `User role updated to ${newRole}` })
    await loadData()
  }

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const profiledUsers = users.filter(u => u.profileComplete)
  const unprofiledUsers = users.filter(u => !u.profileComplete)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Shield className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-muted-foreground text-sm">Manage faculty and auto-generate call schedules</p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-blue-100 rounded-lg p-2"><Users className="h-5 w-5 text-blue-600" /></div>
              <div><p className="text-xl font-bold">{users.length}</p><p className="text-xs text-muted-foreground">Total Faculty</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-green-100 rounded-lg p-2"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div><p className="text-xl font-bold">{profiledUsers.length}</p><p className="text-xs text-muted-foreground">Profiles Complete</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-purple-100 rounded-lg p-2"><Calendar className="h-5 w-5 text-purple-600" /></div>
              <div><p className="text-xl font-bold">{schedules.length}</p><p className="text-xs text-muted-foreground">Schedules</p></div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-orange-100 rounded-lg p-2"><AlertTriangle className="h-5 w-5 text-orange-600" /></div>
              <div><p className="text-xl font-bold">{unprofiledUsers.length}</p><p className="text-xs text-muted-foreground">Incomplete Profiles</p></div>
            </CardContent>
          </Card>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 mb-6 border-b">
          {([
            ['faculty', 'Faculty', Users],
            ['import', 'Add Faculty', UserPlus],
            ['schedules', 'Schedules', Calendar],
            ['create', 'Create Schedule', Play],
            ['credits', 'Credit Log', BookOpen],
          ] as [TabType, string, any][]).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => { setTab(id); if (id === 'credits') loadCredits() }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          {tab === 'view' && (
            <button
              onClick={() => setTab('view')}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 border-blue-600 text-blue-600 -mb-px"
            >
              <ClipboardList className="h-4 w-4" />
              View Schedule
            </button>
          )}
        </div>

        {/* FACULTY TAB */}
        {tab === 'faculty' && (
          <div className="space-y-4">
            {unprofiledUsers.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {unprofiledUsers.length} faculty member(s) haven't completed their profile yet and won't be included in scheduling.
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Faculty Members</CardTitle>
                <CardDescription>Manage faculty profiles and activation status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-left py-2 pr-4">Name</th>
                        <th className="text-left py-2 pr-4">Type</th>
                        <th className="text-left py-2 pr-4">FTE</th>
                        <th className="text-left py-2 pr-4">Assignments</th>
                        <th className="text-left py-2 pr-4">Status</th>
                        <th className="text-left py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2.5 pr-4">
                            <div className="font-medium">{u.name || '—'}</div>
                            <div className="text-xs text-muted-foreground">{u.email}</div>
                          </td>
                          <td className="py-2.5 pr-4">
                            {u.callType ? (
                              <Badge variant={u.callType === 'buddy' ? 'info' : 'secondary'} className="capitalize">
                                {u.callType}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-400">Not set</Badge>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">{u.fte.toFixed(1)}</td>
                          <td className="py-2.5 pr-4">
                            <span className="text-blue-600">{u._count.primaryAssignments}P</span>
                            {' / '}
                            <span className="text-green-600">{u._count.buddyAssignments}B</span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex gap-1">
                              <Badge variant={u.isActive ? 'success' : 'outline'}>
                                {u.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              {u.role === 'admin' && <Badge variant="info">Admin</Badge>}
                              {!u.profileComplete && <Badge variant="warning">No profile</Badge>}
                            </div>
                          </td>
                          <td className="py-2.5">
                            <div className="flex gap-1 flex-wrap">
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 gap-1"
                                onClick={() => openEdit(u)}
                              >
                                <Pencil className="h-3 w-3" />
                                Edit Prefs
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => toggleUserActive(u.id, !u.isActive)}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              {u.id !== session?.user.id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={() => toggleUserRole(u.id, u.role)}
                                >
                                  {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* IMPORT FACULTY TAB */}
        {tab === 'import' && (
          <div className="max-w-2xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add Faculty Members</CardTitle>
                <CardDescription>
                  Enter each physician's name and email. Their temporary password will be their last name (lowercase).
                  They can change it after signing in.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {importRows.map((row, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input
                        placeholder="Dr. Jane Smith"
                        value={row.name}
                        onChange={e => {
                          const updated = [...importRows]
                          updated[i] = { ...updated[i], name: e.target.value }
                          setImportRows(updated)
                        }}
                        className="flex-1"
                      />
                      <Input
                        placeholder="jsmith@hospital.edu"
                        type="email"
                        value={row.email}
                        onChange={e => {
                          const updated = [...importRows]
                          updated[i] = { ...updated[i], email: e.target.value }
                          setImportRows(updated)
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setImportRows(prev => prev.filter((_, j) => j !== i))}
                        disabled={importRows.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setImportRows(prev => [...prev, { name: '', email: '' }])}
                >
                  <Plus className="h-4 w-4" />
                  Add Row
                </Button>

                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800">
                  Temporary passwords are each physician's <strong>last name in lowercase</strong>.
                  For example, "Dr. Jane Smith" → password: <code className="bg-blue-100 px-1 rounded">smith</code>.
                  Each physician should change their password after first login via their profile.
                </div>

                <Button className="w-full gap-2" onClick={importFaculty} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                  Create Faculty Accounts
                </Button>
              </CardContent>
            </Card>

            {/* Results */}
            {importResults.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Import Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground">
                        <th className="text-left py-1.5 pr-4">Name</th>
                        <th className="text-left py-1.5 pr-4">Email</th>
                        <th className="text-left py-1.5 pr-4">Temp Password</th>
                        <th className="text-left py-1.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResults.map((r, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium">{r.name}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{r.email}</td>
                          <td className="py-2 pr-4">
                            {r.tempPassword ? (
                              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{r.tempPassword}</code>
                            ) : '—'}
                          </td>
                          <td className="py-2">
                            <Badge variant={r.status === 'created' ? 'success' : 'warning'}>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* SCHEDULES TAB */}
        {tab === 'schedules' && (
          <div className="space-y-4">
            {schedules.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-30" />
                  <p className="text-muted-foreground">No schedules yet.</p>
                  <Button className="mt-4" onClick={() => setTab('create')}>
                    Create First Schedule
                  </Button>
                </CardContent>
              </Card>
            ) : (
              schedules.map(s => (
                <Card key={s.id} className={s.status === 'published' ? 'border-green-200' : ''}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{s.name}</h3>
                          <Badge variant={s.status === 'published' ? 'success' : 'warning'} className="capitalize">
                            {s.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(s.startDate), 'MMM d, yyyy')} – {format(new Date(s.endDate), 'MMM d, yyyy')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {s._count.assignments} assignments · Created {format(new Date(s.createdAt), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => viewSchedule(s.id)}>
                          <ClipboardList className="h-3.5 w-3.5" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => reassignSchedule(s.id)}
                          disabled={reassigning}
                        >
                          {reassigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                          Re-run
                        </Button>
                        {s.status !== 'published' && (
                          <Button variant="default" size="sm" className="gap-1.5" onClick={() => publishSchedule(s.id)}>
                            <CheckCircle className="h-3.5 w-3.5" />
                            Publish
                          </Button>
                        )}
                        <a href={`/api/admin/schedule/${s.id}?export=xlsx`} download>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Download className="h-3.5 w-3.5" />
                            XLSX
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => deleteSchedule(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}

            {/* Last result card */}
            {lastResult && (
              <ResultCard result={lastResult} />
            )}
          </div>
        )}

        {/* CREATE SCHEDULE TAB */}
        {tab === 'create' && (
          <div className="max-w-xl space-y-6">
            {profiledUsers.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                No faculty have completed their profiles yet. Schedule can be created but will have no assignments.
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Span Presets</CardTitle>
                <CardDescription>Auto-fill date ranges</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {[
                  ['year', 'Full Year'],
                  ['half', 'Half Year'],
                  ['quarter', 'Quarter'],
                ].map(([val, label]) => (
                  <Button
                    key={val}
                    variant={spanPreset === val ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => applySpanPreset(val)}
                  >
                    {label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Schedule Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sname">Schedule Name</Label>
                  <Input
                    id="sname"
                    placeholder="e.g. 2026 Annual Call Schedule"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="sstart">Start Date</Label>
                    <Input id="sstart" type="date" value={newStart} onChange={e => setNewStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="send">End Date</Label>
                    <Input id="send" type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)} />
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
                  <strong>Auto-assignment will:</strong>
                  <ul className="mt-1 space-y-1 list-disc list-inside text-xs">
                    <li>Identify all weekend days and federal holidays in the range</li>
                    <li>Respect each faculty member's blocked dates</li>
                    <li>Pair buddy physicians with partners</li>
                    <li>Balance assignments proportionally by FTE</li>
                    <li>Apply spacing preferences where possible</li>
                  </ul>
                </div>

                <Button
                  className="w-full gap-2"
                  size="lg"
                  onClick={createSchedule}
                  disabled={creating}
                >
                  {creating ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Running Auto-Assignment...</>
                  ) : (
                    <><Play className="h-4 w-4" />Create & Auto-Assign Schedule</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* CREDIT LOG TAB */}
        {tab === 'credits' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-base">Perpetual Workload Credit Log</CardTitle>
                    <CardDescription>
                      Cumulative call credits per academic year (July–June).
                      Loner days = 2 units · Buddy days = 1 unit each.
                      Published schedules automatically update this log.
                    </CardDescription>
                  </div>
                  {availableYears.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {availableYears.map(y => (
                        <Button
                          key={y}
                          size="sm"
                          variant={creditYear === y ? 'default' : 'outline'}
                          onClick={() => loadCredits(y)}
                        >
                          {y}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {credits.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No credits recorded yet.</p>
                    <p className="text-xs mt-1">Credits are logged when a schedule is published.</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 mb-4 space-y-1">
                      <p><strong>Academic Year {creditYear}</strong></p>
                      <p>Workload Units: Loner primary day = <strong>2 units</strong> (covers both roles alone) · Buddy primary or buddy day = <strong>1 unit</strong></p>
                      <p>These cumulative totals are carried forward when generating future schedule blocks to maintain long-term equity.</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 pr-4">Physician</th>
                            <th className="text-left py-2 pr-4">Type</th>
                            <th className="text-left py-2 pr-4">FTE</th>
                            <th className="text-center py-2 pr-4">Primary Days</th>
                            <th className="text-center py-2 pr-4">Buddy Days</th>
                            <th className="text-center py-2 pr-4">Holidays</th>
                            <th className="text-center py-2 pr-4">Workload Units</th>
                            <th className="text-center py-2">Units/FTE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {credits.map(c => (
                            <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                              <td className="py-2.5 pr-4 font-medium">{c.user.name || '—'}</td>
                              <td className="py-2.5 pr-4">
                                <Badge variant={c.user.callType === 'buddy' ? 'info' : 'secondary'} className="capitalize text-xs">
                                  {c.user.callType}
                                </Badge>
                              </td>
                              <td className="py-2.5 pr-4">{c.user.fte.toFixed(1)}</td>
                              <td className="py-2.5 pr-4 text-center text-blue-700">{c.primaryDays}</td>
                              <td className="py-2.5 pr-4 text-center text-green-700">{c.buddyDays}</td>
                              <td className="py-2.5 pr-4 text-center text-amber-700">{c.holidayDays}</td>
                              <td className="py-2.5 pr-4 text-center font-bold">{c.workloadUnits.toFixed(1)}</td>
                              <td className="py-2.5 text-center">
                                {(c.workloadUnits / c.user.fte).toFixed(1)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* VIEW SCHEDULE TAB */}
        {tab === 'view' && selectedSchedule && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{selectedSchedule.name}</h2>
                <p className="text-muted-foreground text-sm">
                  {format(new Date(selectedSchedule.startDate), 'MMM d, yyyy')} – {format(new Date(selectedSchedule.endDate), 'MMM d, yyyy')}
                  {' · '}
                  <Badge variant={selectedSchedule.status === 'published' ? 'success' : 'warning'} className="capitalize">
                    {selectedSchedule.status}
                  </Badge>
                </p>
              </div>
              <a href={`/api/admin/schedule/${selectedSchedule.id}?export=xlsx`} download>
                <Button variant="outline" className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  Download XLSX
                </Button>
              </a>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Date</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Day</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Type</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Primary</th>
                        <th className="text-left py-3 px-4 text-xs text-muted-foreground font-medium">Buddy</th>
                        <th className="py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSchedule.assignments.map(a => (
                        <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-medium">{format(new Date(a.date), 'MM/dd/yyyy')}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{format(new Date(a.date), 'EEE')}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant={
                              a.dayType === 'holiday' ? 'warning' :
                              a.dayType === 'saturday' ? 'info' : 'secondary'
                            } className="capitalize text-xs">
                              {a.dayType}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4">
                            {a.primaryUser?.name || a.primaryUser?.email || (
                              <span className="text-red-400 italic text-xs">Unassigned</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-muted-foreground">
                            {a.buddyUser?.name || a.buddyUser?.email || '—'}
                          </td>
                          <td className="py-2.5 px-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                              onClick={() => openAssignmentEdit(a)}
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Edit Assignment Modal */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">Edit Assignment</h2>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(editingAssignment.date), 'EEEE, MMMM d, yyyy')}
                  {' · '}
                  <span className="capitalize">{editingAssignment.dayType}</span>
                </p>
              </div>
              <button onClick={() => setEditingAssignment(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold block">Primary Physician</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingAssignment.primaryUserId}
                  onChange={e => setEditingAssignment(a => a ? { ...a, primaryUserId: e.target.value } : a)}
                >
                  <option value="">— Unassigned —</option>
                  {users.filter(u => u.isActive && u.profileComplete).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.callType}, {u.fte.toFixed(1)} FTE)
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold block">Buddy Physician</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={editingAssignment.buddyUserId}
                  onChange={e => setEditingAssignment(a => a ? { ...a, buddyUserId: e.target.value } : a)}
                >
                  <option value="">— None —</option>
                  {users.filter(u => u.isActive && u.profileComplete && u.id !== editingAssignment.primaryUserId).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.callType}, {u.fte.toFixed(1)} FTE)
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">Leave blank if no buddy is needed for this day.</p>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
                Manual edits override the auto-assignment. Re-running auto-assign will overwrite these changes.
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t">
              <Button className="flex-1" onClick={saveAssignment} disabled={savingAssignment}>
                {savingAssignment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button variant="outline" onClick={() => setEditingAssignment(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Faculty Preferences Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">{editingUser.name}</h2>
                <p className="text-sm text-muted-foreground">{editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Call Type */}
              <div>
                <p className="text-sm font-semibold mb-2">Call Type</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['loner', 'Loner — works independently'], ['buddy', 'Buddy — always paired']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setEditForm(f => ({ ...f, callType: val }))}
                      className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${editForm.callType === val ? 'border-blue-600 bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Weekend Preference */}
              <div>
                <p className="text-sm font-semibold mb-2">Weekend Preference</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['full', 'Full Weekend (Sat + Sun)'], ['single', 'Single Day only']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setEditForm(f => ({ ...f, weekendPreference: val }))}
                      className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${editForm.weekendPreference === val ? 'border-blue-600 bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Holiday Preference */}
              <div>
                <p className="text-sm font-semibold mb-2">Holiday Preference</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['with-weekend', 'Include with Weekend'], ['separate', 'Holidays Separate']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setEditForm(f => ({ ...f, holidayPreference: val }))}
                      className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${editForm.holidayPreference === val ? 'border-blue-600 bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* FTE */}
              <div>
                <p className="text-sm font-semibold mb-2">FTE: <span className="text-blue-600">{editForm.fte.toFixed(1)}</span></p>
                <input type="range" min="0.1" max="1.0" step="0.1" value={editForm.fte}
                  onChange={e => setEditForm(f => ({ ...f, fte: parseFloat(e.target.value) }))}
                  className="w-full h-2 accent-blue-600" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0.1</span><span>0.5</span><span>1.0</span>
                </div>
              </div>

              {/* Spacing */}
              <div>
                <p className="text-sm font-semibold mb-2">Assignment Spacing</p>
                <div className="grid grid-cols-2 gap-2">
                  {[['maximize', 'Maximize Spacing'], ['no-preference', 'No Preference']].map(([val, label]) => (
                    <button key={val} type="button"
                      onClick={() => setEditForm(f => ({ ...f, spacingPreference: val }))}
                      className={`p-3 rounded-lg border-2 text-left text-sm transition-all ${editForm.spacingPreference === val ? 'border-blue-600 bg-blue-50 font-medium' : 'border-gray-200 hover:border-gray-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Blocked Holidays */}
              <div>
                <p className="text-sm font-semibold mb-2">Always-Blocked Holidays</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {FEDERAL_HOLIDAYS.map(holiday => {
                    const checked = editForm.blockedHolidays.includes(holiday)
                    return (
                      <button key={holiday} type="button"
                        onClick={() => setEditForm(f => ({
                          ...f,
                          blockedHolidays: checked
                            ? f.blockedHolidays.filter(h => h !== holiday)
                            : [...f.blockedHolidays, holiday],
                        }))}
                        className={`flex items-center gap-2 p-2 rounded-lg border-2 text-left text-xs transition-all ${checked ? 'border-red-400 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`h-3.5 w-3.5 rounded border-2 flex items-center justify-center shrink-0 ${checked ? 'border-red-500 bg-red-500' : 'border-gray-300'}`}>
                          {checked && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        {holiday}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 border-t">
              <Button className="flex-1" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Preferences
              </Button>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: AssignmentResult }) {
  const [expanded, setExpanded] = useState(true)
  const { stats } = result
  const scoreColor = stats.score >= 80 ? 'text-green-600' : stats.score >= 60 ? 'text-yellow-600' : 'text-red-600'
  const scoreBg = stats.score >= 80 ? 'bg-green-50 border-green-200' : stats.score >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'

  return (
    <Card className={`border ${scoreBg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Assignment Results</CardTitle>
              <CardDescription>
                {stats.assignedDays}/{stats.totalDays} days assigned · {stats.warnings.length} warnings
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className={`text-3xl font-bold ${scoreColor}`}>{stats.score}</div>
              <div className="text-xs text-muted-foreground">Equity Score</div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-blue-50 border border-blue-100 rounded p-2">
              <p className="font-semibold text-blue-800 mb-0.5">Equity Score = Primary Day Balance</p>
              <p className="text-blue-700">Every faculty member (loner &amp; buddy) targets the same number of primary call days proportional to FTE. Score penalises deviation from that target.</p>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded p-2">
              <p className="font-semibold text-slate-800 mb-0.5">Workload Units (credit log only)</p>
              <p className="text-slate-700"><strong>Loner</strong> primary day = <strong>2 units</strong> — covers both roles alone. <strong>Buddy</strong> primary or buddy day = <strong>1 unit</strong> each. Tracked across the academic year.</p>
            </div>
          </div>

          {/* Faculty breakdown */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Faculty Assignment Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1 pr-3">Name</th>
                    <th className="text-center py-1 pr-3">Type</th>
                    <th className="text-center py-1 pr-3">Primary Days</th>
                    <th className="text-center py-1 pr-3">Target</th>
                    <th className="text-center py-1 pr-3">Balance</th>
                    <th className="text-center py-1 pr-3">Buddy Days</th>
                    <th className="text-center py-1 pr-3">Holidays</th>
                    <th className="text-center py-1">Workload Units</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.userStats.map(u => (
                    <tr key={u.userId} className="border-b last:border-0">
                      <td className="py-1.5 pr-3 font-medium">{u.name}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <Badge variant={u.callType === 'buddy' ? 'info' : 'secondary'} className="text-xs capitalize">{u.callType}</Badge>
                      </td>
                      <td className="py-1.5 pr-3 text-center font-bold text-blue-700">{u.primaryDays}</td>
                      <td className="py-1.5 pr-3 text-center text-muted-foreground">{u.targetPrimaryDays}</td>
                      <td className="py-1.5 pr-3 text-center">
                        <span className={`font-semibold ${u.primaryBalance > 1 ? 'text-red-600' : u.primaryBalance < -1 ? 'text-orange-600' : 'text-green-600'}`}>
                          {u.primaryBalance > 0 ? `+${u.primaryBalance}` : u.primaryBalance}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-center text-green-700">{u.buddyDays}</td>
                      <td className="py-1.5 pr-3 text-center text-amber-700">{u.holidays}</td>
                      <td className="py-1.5 text-center">
                        <span className="font-semibold" title={u.callType === 'loner' ? `${u.primaryDays} days × 2 (loner double-credit)` : `${u.primaryDays} primary + ${u.buddyDays} buddy`}>
                          {u.workloadUnits}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Warnings */}
          {stats.warnings.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />
                Warnings ({stats.warnings.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {stats.warnings.map((w, i) => (
                  <div key={i} className="text-xs bg-yellow-50 border border-yellow-200 rounded px-2 py-1 text-yellow-800">
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
