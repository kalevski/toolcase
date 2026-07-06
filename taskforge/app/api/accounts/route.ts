// Multi-account management surface — list + register Claude identities. The
// whole surface is admin-gated; mutations emit audit records. Never returns
// secrets (the registry stores only the API-key env-var name, never the value).

import { guard, json, error, audit } from '@/server/web/http'
import { listAccountSummaries, registerAccount, AccountExistsError } from '@/server/services/accounts'
import { InvalidAccountError, type AccountInput } from '@/server/data/repositories/account-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res
    return json(listAccountSummaries())
}

export async function POST(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res

    const body = (await req.json().catch(() => ({}))) as Partial<AccountInput>
    if (!body.alias?.trim()) return error('alias required', 400)
    if (body.auth !== 'oauth' && body.auth !== 'apikey') return error('auth must be oauth|apikey', 400)

    try {
        const { account, guidance } = await registerAccount({
            alias: body.alias.trim(),
            auth: body.auth,
            label: body.label,
            apiKeyEnv: body.apiKeyEnv,
        })
        audit(auth, 'account.create', null, `${account.alias} (${account.auth})`)
        return json({ account, guidance }, 201)
    } catch (e) {
        if (e instanceof AccountExistsError) return error(e.message, 409)
        if (e instanceof InvalidAccountError) return error(e.message, 400)
        throw e
    }
}
