import type { Metadata } from 'next'
import { AuthGate } from '@/components/AuthGate'
import { AdminHome } from '@/components/admin/AdminHome'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Admin' }

// /admin is the owner hub — a landing page linking to the five admin areas
// (Sites, Users, Domains, Plans, Audit). AuthGate renders the shell; AdminHome
// redirects any non-owner away.
export default function AdminIndexPage() {
    return (
        <AuthGate>
            <AdminHome />
        </AuthGate>
    )
}
