// GET ?page= — audit log, paged, newest first (admin), spec §8.

import { type NextRequest } from 'next/server'
import { guard, json } from '@/server/web/http'
import * as auditRepo from '@/server/data/repositories/audit-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res
    const page = Math.max(1, Number(new URL(req.url).searchParams.get('page')) || 1)
    return json({
        entries: auditRepo.list(PAGE_SIZE, (page - 1) * PAGE_SIZE),
        total: auditRepo.count(),
        page,
        pageSize: PAGE_SIZE,
    })
}
