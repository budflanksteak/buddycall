import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      callType?: string | null
      profileComplete: boolean
    }
  }

  interface User {
    role: string
    callType?: string | null
    profileComplete: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: string
    callType?: string | null
    profileComplete: boolean
  }
}
