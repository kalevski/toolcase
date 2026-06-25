import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSession } from '@/server/services/auth'
import { LoginClient } from '@/components/LoginClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    // Already signed in? Skip the login screen. The client AuthGate handles the
    // inverse (unauthenticated → /login); this server-side check just avoids
    // showing the sign-in form to a user who already has a valid session.
    if (await getSession()) redirect('/')
    const { error } = await searchParams
    return <LoginClient error={error} />
}
