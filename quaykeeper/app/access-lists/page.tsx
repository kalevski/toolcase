import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AccessLists } from '@/components/routing/AccessLists'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Access lists · Routing' }

export default function AccessListsPage() {
    return (
        <AuthGate>
            <AccessLists />
        </AuthGate>
    )
}
