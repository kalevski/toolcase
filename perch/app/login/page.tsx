import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { authorize } from '@/server/services/auth'
import { LoginClient } from '@/components/LoginClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    // Already signed in *and provisioned*? Skip the login screen. This must use
    // the SAME gate as `/api/me` (`authorize('standard')`), not a bare
    // `getSession()` check: a valid-but-unprovisioned session (e.g. the DB was
    // reset while the browser kept its signed cookie → role resolves to `guest`)
    // is bounced to /login by the client AuthGate, so if /login redirected such a
    // caller back to / on cookie presence alone the two would loop forever.
    if ((await authorize('standard')).ok) redirect('/')
    const { error } = await searchParams
    return <LoginClient error={error} />
}
