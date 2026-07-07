// GET /api/instances/{id}/export?format=dotenv|json — the resolved config
// rendered as text. Unmasked (real secret values) only for the owner role; the
// unmasked export is audited (`config.export`, §7).

import { NextResponse } from 'next/server'
import { authorize } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import * as configVars from '@/server/services/config-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: Request, ctx: Ctx) {
    const authz = await authorize('standard', 'instances')
    if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })

    const format = new URL(req.url).searchParams.get('format') ?? 'dotenv'
    if (format !== 'dotenv' && format !== 'json') {
        return NextResponse.json({ error: 'invalid_format' }, { status: 400 })
    }

    const { id } = await ctx.params
    try {
        const canReadSecrets = authz.role === 'owner'
        const text = configVars.exportInstance(id, format, canReadSecrets)
        if (canReadSecrets) {
            auditRepo.append({
                githubId: authz.session.sub,
                login: authz.session.login,
                action: 'config.export',
                detail: `instance:${id}:${format}`,
            })
        }
        return new NextResponse(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (err) {
        const { status, code } = configVars.httpErrorFor(err)
        return NextResponse.json({ error: code }, { status })
    }
}
