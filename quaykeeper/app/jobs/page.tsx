import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Jobs } from '@/components/jobs/Jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Scheduled tasks' }

export default function JobsPage() {
    return (
        <AuthGate>
            <Jobs />
        </AuthGate>
    )
}
