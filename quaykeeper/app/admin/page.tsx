import { redirect } from 'next/navigation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// /admin has no overview page of its own — the owner hub is the sidebar (Sites,
// Users, Realms, Domains, Certificates, Settings, Audit); bare /admin bounces
// straight to Sites.
export default function AdminIndexPage() {
    redirect('/admin/sites')
}
