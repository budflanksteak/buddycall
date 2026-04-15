"use client"
import { useState } from 'react'
import Link from 'next/link'
import { Brain, Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

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

        <Card>
          {sent ? (
            <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4 text-center">
              <Mail className="h-12 w-12 text-blue-500" />
              <div>
                <h2 className="text-xl font-bold mb-2">Check your email</h2>
                <p className="text-muted-foreground text-sm">
                  If an account exists for <strong>{email}</strong>, you'll receive a reset link shortly.
                </p>
              </div>
              <Link href="/login">
                <Button variant="outline" className="w-full">Back to Sign In</Button>
              </Link>
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>Enter your email and we'll send you a reset link</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@hospital.edu"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Reset Link
                  </Button>
                  <Link href="/login" className="text-sm text-blue-600 hover:underline text-center">
                    Back to Sign In
                  </Link>
                </CardFooter>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
