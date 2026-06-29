import { guardProject, json, error, audit } from '@/server/web/http'
import {
    listCommands,
    renderCommand,
    DockerCommandNotFoundError,
    InstanceEnvUnavailableError,
} from '@/server/services/docker-commands'
import type { DockerLifecycle, DockerRenderFormat } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; cmdId: string }> }

export async function GET(req: Request, { params }: Ctx) {
    const { id, cmdId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res

    const url = new URL(req.url)
    const lifecycle: DockerLifecycle = url.searchParams.get('lifecycle') === 'recreate' ? 'recreate' : 'run'
    const format: DockerRenderFormat = url.searchParams.get('format') === 'compose' ? 'compose' : 'sh'

    const cmd = listCommands(id).find((c) => c.id === cmdId)
    if (!cmd) return error('not found', 404)
    if (cmd.spec.envSource === 'instance') audit(auth, 'docker.render', id, cmdId)

    try {
        const command = renderCommand(id, cmdId, { lifecycle, format })
        return json({ command })
    } catch (e) {
        if (e instanceof InstanceEnvUnavailableError) {
            return error('instance env injection is available after env vars are configured', 422)
        }
        if (e instanceof DockerCommandNotFoundError) return error('not found', 404)
        throw e
    }
}
