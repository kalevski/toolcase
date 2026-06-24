// E1 — per-project settings: GET returns { overrides, effective }, PUT saves
// overrides (undefined/null values clear the key back to the env default).

import { guard, json, error, audit } from '@/server/web/http'
import { projectExists, UnsafePathError } from '@/server/infrastructure/fs-workspace'
import {
    getProjectSettings,
    saveProjectSettings,
    effectiveSettings,
    InvalidSettingsError,
} from '@/server/services/settings'
import type { ProjectSettings } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json({
            overrides: getProjectSettings(params.project),
            effective: effectiveSettings(params.project),
        })
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}

export async function PUT(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const body = (await req.json().catch(() => null)) as ProjectSettings | null
        if (!body || typeof body !== 'object') return error('settings object required', 400)
        const overrides = saveProjectSettings(params.project, body)
        audit(auth, 'settings.save', params.project)
        return json({ overrides, effective: effectiveSettings(params.project) })
    } catch (e) {
        if (e instanceof InvalidSettingsError) return error(e.message, 400)
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        throw e
    }
}
