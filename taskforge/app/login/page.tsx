import { redirect } from 'next/navigation'
import { getSession } from '@/server/services/auth'
import { LoginClient } from '@/components/LoginClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
    if (await getSession()) redirect('/')
    const { error } = await searchParams
    return <LoginClient error={error} />
}
