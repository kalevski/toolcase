import { redirect } from 'next/navigation'
import { requireSession } from '@/server/page-guards'
import { NoAccessClient } from '@/components/NoAccessClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'No access' }

export default async function NoAccessPage() {
    const me = await requireSession()
    if (me.role !== 'guest') redirect('/')
    return <NoAccessClient login={me.login} />
}
