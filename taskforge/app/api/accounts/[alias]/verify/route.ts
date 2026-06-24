// Multi-account management — token-health check for a single identity: runs a
// cheap one-shot `verifyAccount` (a passing run stamps `lastUsedAt`). Admin-only;
// emits an audit record with the outcome.

import { guard, json, error, audit } from '@/server/web/http'
import { verifyAccount, getAccount, UnknownAccountError, MissingApiKeyError } from '@/server/services/accounts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: Request, { params }: { params: { alias: string } }) {
    const auth = await guard('admin')
    if ('res' in auth) return auth.res

    if (!getAccount(params.alias)) return error('account not found', 404)

    try {
        const result = await verifyAccount(params.alias)
        audit(auth, 'account.verify', null, `${params.alias}: ${result.ok ? 'ok' : result.detail}`)
        return json(result)
    } catch (e) {
        if (e instanceof MissingApiKeyError) return error(e.message, 400)
        if (e instanceof UnknownAccountError) return error('account not found', 404)
        throw e
    }
}
