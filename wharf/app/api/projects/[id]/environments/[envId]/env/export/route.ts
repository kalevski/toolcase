import { guardProject, error, audit } from '@/server/web/http'
import { exportEnvironment, ScopeNotFoundError, InterpolationCycleError, type ExportFormat } from '@/server/services/env-vars'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; envId: string }> }

// Export the environment baseline (no instance overrides). Masking + audit as per
// the instance export.
export async function GET(req: Request, { params }: Ctx) {
    const { id, envId } = await params
    const auth = await guardProject(id, 'developer')
    if ('res' in auth) return auth.res
    const fmt = (new URL(req.url).searchParams.get('format') ?? 'dotenv') as ExportFormat
    if (!['dotenv', 'json', 'compose'].includes(fmt)) return error('bad format', 400)
    const canReadSecrets = auth.isOwner || auth.projectRole === 'devops'
    try {
        const text = exportEnvironment(id, envId, fmt, canReadSecrets)
        if (canReadSecrets) audit(auth, 'env.export', id, `env:${envId}:${fmt}`)
        return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    } catch (e) {
        if (e instanceof ScopeNotFoundError) return error('environment not found', 404)
        if (e instanceof InterpolationCycleError) return error(`template cycle at ${e.key}`, 422)
        throw e
    }
}
