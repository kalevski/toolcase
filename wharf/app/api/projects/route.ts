import { guard, json, error, audit } from '@/server/web/http'
import { createProject, listSummariesForUser } from '@/server/services/projects'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/projects — owner sees all, a member sees their own (planning §10).
export async function GET() {
    const auth = await guard('guest')
    if ('res' in auth) return auth.res
    return json(listSummariesForUser(auth.session.sub, auth.role === 'owner'))
}

// POST /api/projects — owner only.
export async function POST(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)
    const project = createProject(name, auth.session.sub)
    audit(auth, 'project.create', project.id, name)
    return json(project, 201)
}
