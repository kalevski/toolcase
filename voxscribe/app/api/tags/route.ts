// GET — tag list + usage counts, scoped to the actor's own notes (admin: all).
// Scoping prevents tag names leaking across owners (spec §4.5).

import { guard, json } from '@/server/web/http'
import * as notes from '@/server/services/notes'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json({
        tags: notes.listTags({ githubId: auth.session.sub, login: auth.session.login, role: auth.role }),
    })
}
