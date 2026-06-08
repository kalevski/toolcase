import { redirect } from 'next/navigation'
import { requireSession } from '@/server/page-guards'
import { NoAccessClient } from '@/components/NoAccessClient'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function NoAccessPage() {
    const me = await requireSession()
    if (me.role !== 'guest') redirect('/')
    return <NoAccessClient login={me.login} />
}
