// GitHub REST integration (B7 PRs, E2 issues import). Fetch-based, no SDK.
// Reuses the push credential (GIT_REMOTE_TOKEN, scope `repo`); owner/repo are
// parsed from the project's clone URL.

import 'server-only'
import { config } from '@/server/config'
import type { GithubIssue } from '@/server/domain/types'

export class GithubError extends Error {
    constructor(
        message: string,
        public status?: number,
    ) {
        super(message)
    }
}

/** Parse `{owner, repo}` from an HTTPS or SSH GitHub clone URL. Null for non-GitHub remotes. */
export function parseGithubRepo(gitUrl: string | undefined): { owner: string; repo: string } | null {
    if (!gitUrl) return null
    const m =
        gitUrl.match(/^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i) ||
        gitUrl.match(/^(?:ssh:\/\/)?git@github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i)
    if (!m) return null
    return { owner: m[1], repo: m[2] }
}

function assertToken(): string {
    if (!config.gitRemoteToken) {
        throw new GithubError('GIT_REMOTE_TOKEN is not configured — GitHub API calls need it.')
    }
    return config.gitRemoteToken
}

async function gh<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = assertToken()
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

/** B7 — create a pull request; returns its html URL. */
export async function createPull(
    owner: string,
    repo: string,
    opts: { title: string; head: string; base: string; body: string },
): Promise<string> {
    const pr = await gh<{ html_url: string }>('POST', `/repos/${owner}/${repo}/pulls`, opts)
    return pr.html_url
}

/** The repository's default branch (PR base). */
export async function defaultBranch(owner: string, repo: string): Promise<string> {
    const data = await gh<{ default_branch: string }>('GET', `/repos/${owner}/${repo}`)
    return data.default_branch
}

/** E2 — open issues (excludes PRs), newest first. */
export async function listOpenIssues(owner: string, repo: string, limit = 50): Promise<GithubIssue[]> {
    const data = await gh<
        { number: number; title: string; body: string | null; html_url: string; pull_request?: unknown; labels: { name?: string }[] }[]
    >('GET', `/repos/${owner}/${repo}/issues?state=open&per_page=${Math.min(limit, 100)}`)
    return data
        .filter((i) => !i.pull_request)
        .map((i) => ({
            number: i.number,
            title: i.title,
            body: i.body ?? '',
            labels: i.labels.map((l) => l.name ?? '').filter(Boolean),
            url: i.html_url,
        }))
}

/** E2 — comment on an issue (best-effort completion hook). */
export async function commentIssue(owner: string, repo: string, number: number, body: string): Promise<void> {
    await gh('POST', `/repos/${owner}/${repo}/issues/${number}/comments`, { body })
}

/** E2 — close an issue. */
export async function closeIssue(owner: string, repo: string, number: number): Promise<void> {
    await gh('PATCH', `/repos/${owner}/${repo}/issues/${number}`, { state: 'closed' })
}
