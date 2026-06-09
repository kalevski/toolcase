import { guard, json, error } from '@/server/web/http'
import { readSkill, writeSkill, deleteSkill, skillExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { name: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        const content = await readSkill(params.name)
        return json({ name: params.name, content })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('skill not found', 404)
    }
}

export async function PUT(req: Request, { params }: { params: { name: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { content?: string }
    if (typeof body.content !== 'string') return error('content required', 400)
    try {
        await writeSkill(params.name, body.content)
        return json({ name: params.name })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await skillExists(params.name))) return error('skill not found', 404)
        await deleteSkill(params.name)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
