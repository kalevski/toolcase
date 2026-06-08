// Injection-safe git wrapper (§6.14–6.16, §10).
// Every call is `spawn('git', argv, { cwd })` — argv array, no shell. Ordinary
// ops run inside the project's `repo/` checkout (projectRepoDir); `clone` runs
// at the project root and creates `repo/`.

import 'server-only'
import { spawn } from 'node:child_process'
import { config, canPush } from './config'
import { projectPath, projectRepoDir } from './fs-workspace'
import type { GitCommit, GitStatus } from './types'

export class GitError extends Error {
    constructor(
        message: string,
        public code: number | null,
        public stderr: string,
    ) {
        super(message)
    }
}

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/

// Accept the URL forms a clone can sensibly take; reject anything else so a
// crafted value can't smuggle a local-transport / helper trick. `--` in the
// argv additionally blocks option-injection regardless of content.
const GIT_URL_RE = /^(https?:\/\/|ssh:\/\/|git:\/\/|[A-Za-z0-9._-]+@[A-Za-z0-9._-]+:).+/

export function assertSafeGitUrl(url: string): void {
    if (!url || !GIT_URL_RE.test(url) || /\s/.test(url)) {
        throw new GitError(`Invalid git URL: ${JSON.stringify(url)}`, null, '')
    }
}

/**
 * `-c credential.helper=…` args that feed an HTTPS token via a one-shot helper
 * so it never lands in argv logs. Empty when no token is configured.
 */
function tokenCredentialArgs(): string[] {
    if (!config.gitRemoteToken) return []
    return [
        '-c',
        `credential.helper=!f() { echo "username=x-access-token"; echo "password=${config.gitRemoteToken}"; }; f`,
    ]
}

interface GitResult {
    stdout: string
    stderr: string
    code: number | null
}

function run(cwd: string, argv: string[], extraEnv: Record<string, string> = {}): Promise<GitResult> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', argv, {
            cwd,
            env: {
                ...process.env,
                GIT_TERMINAL_PROMPT: '0',
                GIT_AUTHOR_NAME: config.gitAuthorName,
                GIT_AUTHOR_EMAIL: config.gitAuthorEmail,
                GIT_COMMITTER_NAME: config.gitAuthorName,
                GIT_COMMITTER_EMAIL: config.gitAuthorEmail,
                ...extraEnv,
            },
        })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d) => (stdout += d.toString()))
        child.stderr.on('data', (d) => (stderr += d.toString()))
        child.on('error', (err) => reject(new GitError(err.message, null, stderr)))
        child.on('close', (code) => resolve({ stdout, stderr, code }))
    })
}

async function git(project: string, argv: string[], extraEnv?: Record<string, string>): Promise<string> {
    const res = await run(projectRepoDir(project), argv, extraEnv)
    if (res.code !== 0) {
        throw new GitError(`git ${argv.join(' ')} failed (exit ${res.code})`, res.code, res.stderr)
    }
    return res.stdout
}

/**
 * Clone `url` into the project's `repo/` directory. Runs at the project root
 * (which already exists); `repo/` must not yet exist. Uses the token credential
 * helper for private HTTPS clones when `GIT_REMOTE_TOKEN` is set.
 */
export async function clone(project: string, url: string, branch?: string): Promise<void> {
    assertSafeGitUrl(url)
    const argv = [...tokenCredentialArgs(), 'clone']
    if (branch) {
        if (!BRANCH_RE.test(branch) || branch.includes('..')) {
            throw new GitError(`Invalid branch name: ${branch}`, null, '')
        }
        argv.push('--branch', branch)
    }
    argv.push('--', url, projectRepoDir(project))
    const res = await run(projectPath(project), argv)
    if (res.code !== 0) {
        throw new GitError(`git clone failed (exit ${res.code})`, res.code, res.stderr)
    }
}

/** True when the working tree is clean (no staged/unstaged changes). */
export async function isClean(project: string): Promise<boolean> {
    const out = await git(project, ['status', '--porcelain'])
    return out.trim() === ''
}

/** Repo-relative paths of every dirty (modified/untracked/staged) entry. */
export async function dirtyFiles(project: string): Promise<string[]> {
    const out = await git(project, ['status', '--porcelain'])
    return out.split('\n').flatMap((l) => {
        const path = l.slice(3).trim()
        return path ? [path] : []
    })
}

export async function status(project: string): Promise<GitStatus> {
    let branch: string
    try {
        branch = (await git(project, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    } catch {
        branch = '(unknown)'
    }

    const dirty = await dirtyFiles(project)

    let ahead = 0
    let behind = 0
    try {
        // counts vs the upstream, if one is configured
        const counts = (await git(project, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']))
            .trim()
            .split(/\s+/)
        if (counts.length === 2) {
            behind = Number(counts[0]) || 0
            ahead = Number(counts[1]) || 0
        }
    } catch {
        /* no upstream configured yet */
    }

    let remotes: string[] = []
    try {
        remotes = (await git(project, ['remote'])).split('\n').flatMap((s) => {
            const name = s.trim()
            return name ? [name] : []
        })
    } catch {
        /* none */
    }

    return {
        branch,
        dirty: dirty.length > 0,
        dirtyFiles: dirty,
        ahead,
        behind,
        remotes,
        canPush: canPush() && remotes.length > 0,
    }
}

/** Stage everything and commit. Returns the new sha, or null on an empty diff. */
export async function commitAll(project: string, message: string): Promise<string | null> {
    await git(project, ['add', '-A'])
    // Anything staged?
    const staged = await git(project, ['diff', '--cached', '--name-only'])
    if (staged.trim() === '') return null
    await git(project, [
        '-c',
        `user.name=${config.gitAuthorName}`,
        '-c',
        `user.email=${config.gitAuthorEmail}`,
        'commit',
        '-m',
        message,
    ])
    return (await git(project, ['rev-parse', 'HEAD'])).trim()
}

/** Return the staged diff (used to feed the AI commit-message skill). */
export async function stagedDiff(project: string): Promise<string> {
    try {
        return await git(project, ['diff', '--cached'])
    } catch {
        return ''
    }
}

export async function stageAll(project: string): Promise<void> {
    await git(project, ['add', '-A'])
}

/** Diff of all tracked changes vs HEAD (used to hint the knowledge updater). */
export async function workingDiff(project: string): Promise<string> {
    try {
        return await git(project, ['diff', 'HEAD'])
    } catch {
        return ''
    }
}

export async function createOrSwitchBranch(project: string, name: string): Promise<void> {
    if (!BRANCH_RE.test(name) || name.includes('..')) {
        throw new GitError(`Invalid branch name: ${name}`, null, '')
    }
    const branches = await git(project, ['branch', '--list', name])
    if (branches.trim() !== '') {
        await git(project, ['switch', name])
    } else {
        await git(project, ['switch', '-c', name])
    }
}

async function currentBranch(project: string): Promise<string> {
    return (await git(project, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

export async function push(project: string): Promise<void> {
    if (!canPush()) {
        throw new GitError('No push credential configured (GIT_REMOTE_TOKEN or SSH key).', null, '')
    }
    const branch = await currentBranch(project)
    // When an HTTPS token is provided, feed it via a one-shot credential helper
    // so it never touches the argv or the run log.
    const argv = [...tokenCredentialArgs(), 'push', '-u', 'origin', branch]
    await git(project, argv)
}

// ── read-only history (git page) ─────────────────────────────────────────────

// Field-separated so subjects with spaces/`|` survive intact; unit separator
// (0x1f) can't appear in a commit subject.
const LOG_FORMAT = '--format=%H%x1f%s%x1f%aI%x1f%an'

function parseLog(out: string): GitCommit[] {
    return out.split('\n').flatMap((line) => {
        if (!line.trim()) return []
        const [sha, subject, date, author] = line.split('\x1f')
        if (!sha) return []
        return [{ sha, subject: subject ?? '', date: date ?? '', author: author ?? '' }]
    })
}

/** Commits on HEAD not yet on the upstream (what a push would send). Empty when no upstream is configured. */
export async function unpushedCommits(project: string): Promise<GitCommit[]> {
    try {
        const out = await git(project, ['log', LOG_FORMAT, '@{upstream}..HEAD'])
        return parseLog(out)
    } catch {
        // no upstream configured yet, or empty repo
        return []
    }
}

/** Most recent commits on HEAD, newest first. */
export async function recentCommits(project: string, limit = 15): Promise<GitCommit[]> {
    try {
        const out = await git(project, ['log', LOG_FORMAT, `-n`, String(limit)])
        return parseLog(out)
    } catch {
        return []
    }
}

// ── working-tree / remote operations (git page) ──────────────────────────────

/** Fetch every remote and prune deleted upstream branches. */
export async function fetchRemote(project: string): Promise<void> {
    await git(project, [...tokenCredentialArgs(), 'fetch', '--all', '--prune'])
}

/** Fast-forward-only pull of the current branch's upstream. Refuses to create a merge commit. */
export async function pull(project: string): Promise<void> {
    await git(project, [...tokenCredentialArgs(), 'pull', '--ff-only'])
}

/** Hard-reset to HEAD and remove untracked files/dirs — wipes the working tree clean. Destructive. */
export async function discardAll(project: string): Promise<void> {
    await git(project, ['reset', '--hard', 'HEAD'])
    await git(project, ['clean', '-fd'])
}
