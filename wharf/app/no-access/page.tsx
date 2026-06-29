import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { requireSession, hasAnyAccess } from '@/server/web/page-guards'
import { NoAccessClient } from '@/components/NoAccessClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'No access' }

export default async function NoAccessPage() {
    const me = await requireSession()
    if (await hasAnyAccess(me.githubId)) redirect('/')
    return <NoAccessClient login={me.login} />
}
