import { guard, json, error, audit } from '@/server/web/http'
import { cloneProject, ProjectNotFoundError } from '@/server/services/clones'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

// Clone a whole project (owner only). `copySecretValues` defaults on (decision #14).
export async function POST(req: Request, { params }: Ctx) {
    const { id } = await params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { newName?: string; copySecretValues?: boolean }
    const newName = (body.newName ?? '').trim()
    if (!newName) return error('newName required', 400)
    try {
        const project = cloneProject(id, newName, body.copySecretValues !== false, auth.session.sub)
        audit(auth, 'project.clone', project.id, `from:${id}`)
        return json(project, 201)
    } catch (e) {
        if (e instanceof ProjectNotFoundError) return error('not found', 404)
        throw e
    }
}
