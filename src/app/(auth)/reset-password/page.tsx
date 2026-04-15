"use client"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Brain, Loader2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

function ResetForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast({ title: 'Passwords do not match', variant: 'destructive' })
      return
    }
    if (!token) {
      toast({ title: 'Invalid reset link', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Reset failed', description: data.error, variant: 'destructive' })
      } else {
        setDone(true)
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
          <CheckCircle className="h-16 w-16 text-green-500" />
          <h2 className="text-2xl font-bold">Password Reset!</h2>
          <p className="text-muted-foreground">Your password has been updated successfully.</p>
          <Button onClick={() => router.push('/login')} className="w-full">Sign In</Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Set New Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm Password</Label>
            <Input
              id="confirm"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 rounded-2xl p-3">
              <Brain className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-blue-900">Neurorad AutoPilot</h1>
        </div>
        <Suspense fallback={<div>Loading...</div>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  )
}
