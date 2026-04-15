"use client"
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Brain, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (!result || result.error) {
        toast({
          title: 'Sign in failed',
          description: result?.error === 'CredentialsSignin'
            ? 'Invalid email or password.'
            : (result?.error || 'Unknown error — check the server console.'),
          variant: 'destructive',
        })
      } else {
        window.location.href = '/'
      }
    } catch (err: any) {
      toast({ title: 'Sign in error', description: err?.message || 'Unexpected error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 rounded-2xl p-3">
              <Brain className="h-10 w-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-blue-900">Neurorad AutoPilot</h1>
          <p className="text-muted-foreground mt-1">Radiology Call Scheduling System</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
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
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Don't have an account?{' '}
                <Link href="/register" className="text-blue-600 hover:underline font-medium">
                  Create account
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
