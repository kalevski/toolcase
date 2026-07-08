import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { authorize } from '@/server/services/auth'
import { LoginClient } from '@/components/LoginClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    // Already signed in *and provisioned*? Skip the login screen. Uses the SAME
    // gate as `/api/me` (`authorize('standard')`), not a bare session check: a
    // valid-but-unprovisioned session (guest) must not redirect-loop.
    if ((await authorize('standard')).ok) redirect('/')
    const { error } = await searchParams
    return <LoginClient error={error} />
}
