import { guardProject, json, error, audit } from '@/server/web/http'
import {
    listCommands,
    createCommand,
    DockerCommandExistsError,
} from '@/server/services/docker-commands'
import type { DockerSpec } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    return json(listCommands(id))
}

export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        name?: string
        spec?: DockerSpec
        instanceId?: string | null
    }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    if (!body.spec) return error('spec required', 400)
    try {
        const cmd = createCommand(
            id,
            { name, spec: body.spec, instanceId: body.instanceId ?? undefined },
            auth.session.sub,
        )
        audit(auth, 'docker.create', id, name)
        return json(cmd, 201)
    } catch (e) {
        if (e instanceof DockerCommandExistsError) return error('command name already exists', 409)
        throw e
    }
}
