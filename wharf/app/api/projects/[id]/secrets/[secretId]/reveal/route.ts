import { guardProject, json, error, audit } from '@/server/web/http'
import { revealSecret, SecretNotFoundError } from '@/server/services/secrets'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; secretId: string }> }

// Devops-only audited plaintext reveal (planning §2.4, §11).
export async function GET(_req: Request, { params }: Ctx) {
    const { id, secretId } = await params
    const auth = await guardProject(id, 'devops')
    if ('res' in auth) return auth.res
    try {
        const value = revealSecret(id, secretId)
        audit(auth, 'secret.reveal', id, secretId)
        return json({ value })
    } catch (e) {
        if (e instanceof SecretNotFoundError) return error('not found', 404)
        throw e
    }
}
