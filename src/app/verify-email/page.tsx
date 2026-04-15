"use client"
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Brain, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    if (!token) { setStatus('error'); return }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(d => setStatus(d.success ? 'success' : 'error'))
      .catch(() => setStatus('error'))
  }, [token])

  return (
    <Card className="w-full max-w-md text-center">
      <CardContent className="pt-8 pb-6 flex flex-col items-center gap-4">
        {status === 'loading' && (
          <><Loader2 className="h-12 w-12 animate-spin text-blue-500" /><p>Verifying your email...</p></>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">Email Verified!</h2>
            <p className="text-muted-foreground">Your account is now active. Please sign in.</p>
            <Button onClick={() => router.push('/login')} className="w-full">Sign In</Button>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-red-500" />
            <h2 className="text-2xl font-bold">Verification Failed</h2>
            <p className="text-muted-foreground">This link is invalid or has expired.</p>
            <Button variant="outline" onClick={() => router.push('/login')}>Go to Sign In</Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function VerifyEmailPage() {
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
        <Suspense fallback={<div className="text-center">Loading...</div>}>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  )
}
