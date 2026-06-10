// C1 — global prompt template library (cross-project, named).

import { guard, json, error, audit } from '@/server/web/http'
import * as promptHistoryRepo from '@/server/data/repositories/prompt-history-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const agent = new URL(req.url).searchParams.get('agent') ?? undefined
    return json(promptHistoryRepo.listTemplates(agent || undefined))
}

export async function POST(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    const body = (await req.json().catch(() => ({}))) as { name?: string; agent?: string; prompt?: string }
    if (!body.name?.trim()) return error('name required', 400)
    if (!body.agent?.trim()) return error('agent required', 400)
    if (!body.prompt?.trim()) return error('prompt required', 400)
    const template = promptHistoryRepo.saveTemplate(body.name.trim().slice(0, 80), body.agent, body.prompt)
    audit(auth, 'prompt-template.create', null, template.name)
    return json(template, 201)
}
