import { auth } from './lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // Public routes
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']
  if (publicPaths.some(p => pathname.startsWith(p))) {
    if (isLoggedIn && (pathname === '/login' || pathname === '/register')) {
      return NextResponse.redirect(new URL('/', req.url))
    }
    return NextResponse.next()
  }

  // Protected routes
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Admin-only routes
  if (pathname.startsWith('/admin') && req.auth?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
