import { guardProject, json, error, audit } from '@/server/web/http'
import {
    listCommands,
    updateCommand,
    deleteCommand,
    DockerCommandExistsError,
    DockerCommandNotFoundError,
    DockerSpecInvalidError,
} from '@/server/services/docker-commands'
import type { DockerSpec } from '@/server/domain/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; cmdId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
    const { id, cmdId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const cmd = listCommands(id).find((c) => c.id === cmdId)
    if (!cmd) return error('not found', 404)
    return json(cmd)
}

export async function PATCH(req: Request, { params }: Ctx) {
    const { id, cmdId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as {
        name?: string
        spec?: DockerSpec
        instanceId?: string | null
    }
    try {
        const cmd = updateCommand(id, cmdId, {
            name: body.name,
            spec: body.spec,
            instanceId: body.instanceId,
        })
        audit(auth, 'docker.update', id, cmdId)
        return json(cmd)
    } catch (e) {
        if (e instanceof DockerSpecInvalidError) return error(e.message || 'invalid spec', 400)
        if (e instanceof DockerCommandNotFoundError) return error('not found', 404)
        if (e instanceof DockerCommandExistsError) return error('command name already exists', 409)
        throw e
    }
}

export async function DELETE(_req: Request, { params }: Ctx) {
    const { id, cmdId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        deleteCommand(id, cmdId)
        audit(auth, 'docker.delete', id, cmdId)
        return json({ ok: true })
    } catch (e) {
        if (e instanceof DockerCommandNotFoundError) return error('not found', 404)
        throw e
    }
}
