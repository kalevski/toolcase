import { guard, json, error } from '@/server/http'
import { listSkills, skillExists, writeSkill, assertSafeSkillName, UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(await listSkills())
}

export async function POST(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    const body = (await req.json().catch(() => ({}))) as { name?: string; content?: string }
    if (!body.name) return error('name required', 400)
    try {
        assertSafeSkillName(body.name)
    } catch {
        return error('invalid skill name (use ^[a-z0-9-]+$)', 400)
    }
    if (await skillExists(body.name)) return error('skill already exists', 409)

    const content =
        body.content ??
        `---\nname: ${body.name}\ndescription: \n---\n\n# ${body.name}\n`
    await writeSkill(body.name, content)
    return json({ name: body.name }, 201)
}
