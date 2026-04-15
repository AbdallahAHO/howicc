/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    auth: {
      user: import('@howicc/auth/server').User | null
      session: import('@howicc/auth/server').Session['session'] | null
      status: 'authenticated' | 'anonymous' | 'unauthenticated'
    }
    authApiUrl: string
    runtimeApiUrl: string
  }
}
