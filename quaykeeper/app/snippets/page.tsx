import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { Snippets } from '@/components/snippets/Snippets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Docker snippets' }

export default function SnippetsPage() {
    return (
        <AuthGate>
            <Snippets />
        </AuthGate>
    )
}
