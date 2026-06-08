import { redirect } from 'next/navigation'
import { getSession } from '@/server/auth'
import { LoginClient } from '@/components/LoginClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
    if (getSession()) redirect('/')
    return <LoginClient error={searchParams?.error} />
}
