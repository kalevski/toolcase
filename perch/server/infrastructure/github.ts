// GitHub REST integration for the create-site wizard (§9 step 1, §13). Fetch-based,
// no SDK — mirrors TaskForge's `server/infrastructure/github.ts` (base URL, bearer
// auth header, JSON + error handling). The one difference: TaskForge reuses a single
// configured push credential, whereas Perch is multi-tenant, so `gh()` is reused with
// the *caller's* OAuth access token, passed in per request.

import 'server-only'

export class GithubError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message)
    }
}

/** A repo trimmed to what the wizard needs to pick a deploy source (§9, §13). */
export interface GithubRepoSummary {
    /** Repository name (without the owner prefix). */
    name: string
    /** Owner login — needed to address the branches route `/{owner}/{repo}/branches`. */
    owner: string
    /** The repo's default branch (the wizard's default selection). */
    defaultBranch: string
    /** Whether the repo is private (free tier deploys public repos only — §9). */
    private: boolean
}

/** A branch trimmed to just its name (§9, §13). */
export interface GithubBranchSummary {
    name: string
}

/**
 * Core fetch helper, reused with the caller's access token. Mirrors TaskForge's
 * `gh()` — same base URL, `Bearer` auth, API-version header, no-store cache, and
 * message extraction on failure — but takes the token as its first argument
 * instead of reading a global config credential.
 */
async function gh<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`https://api.github.com${path}`, {
        method,
        cache: 'no-store',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const detail = await res
            .json()
            .then((d: any) => d?.message ?? '')
            .catch(() => '')
        throw new GithubError(`GitHub ${method} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`, res.status)
    }
    return (await res.json()) as T
}

/** List the repos the caller's token can see, most-recently-updated first (§9 step 1). */
export async function listRepos(token: string): Promise<GithubRepoSummary[]> {
    const data = await gh<
        { name: string; default_branch: string; private: boolean; owner: { login: string } | null }[]
    >(token, 'GET', '/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member')
    return data.map((r) => ({
        name: r.name,
        owner: r.owner?.login ?? '',
        defaultBranch: r.default_branch,
        private: r.private,
    }))
}

/**
 * Fetch one repo's metadata with the caller's token (§9). Used to re-verify a
 * repo's `private` flag server-side at create time — the client-sent flag is never
 * trusted for the plan gate (C2). Throws `GithubError` (404 when the token can't
 * see the repo, which is itself a signal the repo is private/inaccessible).
 */
export async function getRepo(token: string, owner: string, repo: string): Promise<GithubRepoSummary> {
    const r = await gh<{ name: string; default_branch: string; private: boolean; owner: { login: string } | null }>(
        token,
        'GET',
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    )
    return { name: r.name, owner: r.owner?.login ?? owner, defaultBranch: r.default_branch, private: r.private }
}

/** List the branches of one repo (§9 step 1). */
export async function listBranches(token: string, owner: string, repo: string): Promise<GithubBranchSummary[]> {
    const data = await gh<{ name: string }[]>(
        token,
        'GET',
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches?per_page=100`,
    )
    return data.map((b) => ({ name: b.name }))
}
