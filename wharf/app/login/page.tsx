import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getSession } from '@/server/services/auth'
import { LoginClient } from '@/components/LoginClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    // Already signed in? Leave /login; the home page's requireAppAccess routes a
    // guest-without-access on to /no-access, so there is no redirect loop.
    if (await getSession()) redirect('/')
    const { error } = await searchParams
    return <LoginClient error={error} />
}
