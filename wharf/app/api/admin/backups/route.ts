import { guard, json, audit } from '@/server/web/http'
import { listBackups, takeBackup } from '@/server/services/backups'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Owner-only (planning §9). GET = list; POST = take a manual snapshot now.
export async function GET() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(listBackups())
}

export async function POST() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const backup = takeBackup('manual', auth.session.sub)
    audit(auth, 'backup.create', null, backup.id)
    return json(backup, 201)
}
