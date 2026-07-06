// Saved git SSH keys — remove one (registry row + owner-only key file).
// Owner-gated; refuses (409) while a project still references the key, since
// that repo's core.sshCommand points at the file.

import { guard, json, error, audit } from '@/server/web/http'
import { removeKey, GitKeyInUseError } from '@/server/services/git-keys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(_req: Request, ctx: { params: Promise<{ alias: string }> }) {
    const params = await ctx.params
    const auth = await guard('owner')
    if ('res' in auth) return auth.res

    try {
        const removed = await removeKey(params.alias)
        if (!removed) return error('SSH key not found', 404)
    } catch (e) {
        if (e instanceof GitKeyInUseError) return error(e.message, 409)
        throw e
    }

    audit(auth, 'gitkey.delete', null, params.alias)
    return json({ ok: true })
}
