import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { LoginClient } from '@/components/LoginClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Sign in' }

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
    if (getSession()) redirect('/')
    return <LoginClient error={searchParams?.error} />
}
