// Saved git SSH keys — list + save. Listing is metadata only (alias / label /
// createdAt, never key material) and standard-gated so anyone who can create a
// project can pick a key. Saving accepts the private key exactly once
// (write-only — it lands in an owner-only file, never the DB, never a response)
// and is owner-gated like the other credential surfaces.

import { guard, json, error, audit } from '@/server/web/http'
import { listKeys, saveKey, GitKeyExistsError } from '@/server/services/git-keys'
import { InvalidGitKeyError } from '@/server/data/repositories/git-key-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(listKeys())
}

export async function POST(req: Request) {
    const auth = await guard('owner')
    if ('res' in auth) return auth.res

    const body = (await req.json().catch(() => ({}))) as {
        alias?: string
        label?: string
        privateKey?: string
    }
    const alias = (body.alias ?? '').trim()
    if (!alias) return error('alias required', 400)
    if (!body.privateKey?.trim()) return error('privateKey required', 400)

    try {
        const key = await saveKey({ alias, label: body.label, privateKey: body.privateKey })
        // Audit the alias only — never the key material.
        audit(auth, 'gitkey.create', null, alias)
        return json(key, 201)
    } catch (e) {
        if (e instanceof GitKeyExistsError) return error(e.message, 409)
        if (e instanceof InvalidGitKeyError) return error(e.message, 400)
        throw e
    }
}
