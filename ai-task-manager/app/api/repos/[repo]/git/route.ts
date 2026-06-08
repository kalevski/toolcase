import { guard, json, error } from '@/server/http'
import { status } from '@/server/git'
import { repoExists, UnsafePathError } from '@/server/fs-workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { repo: string } }) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    try {
        if (!(await repoExists(params.repo))) return error('repo not found', 404)
        return json(await status(params.repo))
    } catch (e) {
        if (e instanceof UnsafePathError) return error('invalid name', 400)
        return error('git status failed', 500)
    }
}
