// B3 — per-project run schedule (one per project): GET / PUT / DELETE.

import { guard, json, error, audit, errorFrom } from '@/server/web/http'
import { projectExists } from '@/server/infrastructure/fs-workspace'
import { ensureSchedulerStarted } from '@/server/services/scheduler'
import { parseCron } from '@/server/domain/cron'
import { config } from '@/server/config'
import * as scheduleRepo from '@/server/data/repositories/schedule-repo'
import type { RunOptions } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        return json(scheduleRepo.get(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

export async function PUT(req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        const body = (await req.json().catch(() => ({}))) as {
            cron?: string
            enabled?: boolean
            onlyIfPending?: boolean
            skipAboveUsage?: number | null
            options?: Partial<RunOptions>
        }
        if (!body.cron?.trim()) return error('cron required', 400)
        parseCron(body.cron) // InvalidCronError → 400 via errorFrom below
        const options = body.options ?? {}
        if (options.model && !config.modelCatalog.includes(options.model)) {
            return error(`model not in catalog: ${options.model}`, 400)
        }
        let skipAboveUsage: number | null = null
        if (body.skipAboveUsage !== undefined && body.skipAboveUsage !== null) {
            const n = Number(body.skipAboveUsage)
            if (!Number.isFinite(n) || n < 1 || n > 100) return error('skipAboveUsage must be 1–100', 400)
            skipAboveUsage = n
        }

        scheduleRepo.upsert({
            project: params.project,
            cron: body.cron.trim(),
            options,
            enabled: body.enabled ?? true,
            onlyIfPending: body.onlyIfPending ?? true,
            skipAboveUsage,
        })
        ensureSchedulerStarted()
        audit(auth, 'schedule.save', params.project, `${body.cron.trim()}${body.enabled === false ? ' (disabled)' : ''}`)
        return json(scheduleRepo.get(params.project))
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ project: string }> }) {
    const params = await ctx.params
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await projectExists(params.project))) return error('project not found', 404)
        scheduleRepo.remove(params.project)
        audit(auth, 'schedule.delete', params.project)
        return json({ ok: true })
    } catch (e) {
        const res = errorFrom(e)
        if (res) return res
        throw e
    }
}
