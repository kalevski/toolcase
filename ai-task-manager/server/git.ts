// Injection-safe git wrapper (§6.14–6.16, §10).
// Every call is `spawn('git', argv, { cwd: repoPath })` — argv array, no shell,
// repo path validated by the caller via fs-workspace.repoPath().

import 'server-only'
import { spawn } from 'node:child_process'
import { config, canPush } from './config'
import { repoPath } from './fs-workspace'
import type { GitStatus } from './types'

export class GitError extends Error {
    constructor(
        message: string,
        public code: number | null,
        public stderr: string,
    ) {
        super(message)
    }
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

async function git(repo: string, argv: string[], extraEnv?: Record<string, string>): Promise<string> {
    const res = await run(repoPath(repo), argv, extraEnv)
    if (res.code !== 0) {
        throw new GitError(`git ${argv.join(' ')} failed (exit ${res.code})`, res.code, res.stderr)
    }
    return res.stdout
}

/** True when the working tree is clean (no staged/unstaged changes). */
export async function isClean(repo: string): Promise<boolean> {
    const out = await git(repo, ['status', '--porcelain'])
    return out.trim() === ''
}

/** Repo-relative paths of every dirty (modified/untracked/staged) entry. */
export async function dirtyFiles(repo: string): Promise<string[]> {
    const out = await git(repo, ['status', '--porcelain'])
    return out
        .split('\n')
        .map((l) => l.slice(3).trim())
        .filter(Boolean)
}

export async function status(repo: string): Promise<GitStatus> {
    let branch = ''
    try {
        branch = (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
    } catch {
        branch = '(unknown)'
    }

    const dirty = await dirtyFiles(repo)

    let ahead = 0
    let behind = 0
    try {
        // counts vs the upstream, if one is configured
        const counts = (await git(repo, ['rev-list', '--left-right', '--count', '@{upstream}...HEAD']))
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
        remotes = (await git(repo, ['remote']))
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
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
export async function commitAll(repo: string, message: string): Promise<string | null> {
    await git(repo, ['add', '-A'])
    // Anything staged?
    const staged = await git(repo, ['diff', '--cached', '--name-only'])
    if (staged.trim() === '') return null
    await git(repo, [
        '-c',
        `user.name=${config.gitAuthorName}`,
        '-c',
        `user.email=${config.gitAuthorEmail}`,
        'commit',
        '-m',
        message,
    ])
    return (await git(repo, ['rev-parse', 'HEAD'])).trim()
}

/** Return the staged diff (used to feed the AI commit-message skill). */
export async function stagedDiff(repo: string): Promise<string> {
    try {
        return await git(repo, ['diff', '--cached'])
    } catch {
        return ''
    }
}

export async function stageAll(repo: string): Promise<void> {
    await git(repo, ['add', '-A'])
}

const BRANCH_RE = /^[A-Za-z0-9._/-]+$/

export async function createOrSwitchBranch(repo: string, name: string): Promise<void> {
    if (!BRANCH_RE.test(name) || name.includes('..')) {
        throw new GitError(`Invalid branch name: ${name}`, null, '')
    }
    const branches = await git(repo, ['branch', '--list', name])
    if (branches.trim() !== '') {
        await git(repo, ['switch', name])
    } else {
        await git(repo, ['switch', '-c', name])
    }
}

export async function currentBranch(repo: string): Promise<string> {
    return (await git(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim()
}

export async function push(repo: string): Promise<void> {
    if (!canPush()) {
        throw new GitError('No push credential configured (GIT_REMOTE_TOKEN or SSH key).', null, '')
    }
    const branch = await currentBranch(repo)
    // When an HTTPS token is provided, feed it via a one-shot credential helper
    // so it never touches the argv or the run log.
    const extraEnv: Record<string, string> = {}
    const argv = ['push', '-u', 'origin', branch]
    if (config.gitRemoteToken) {
        argv.unshift(
            '-c',
            `credential.helper=!f() { echo "username=x-access-token"; echo "password=${config.gitRemoteToken}"; }; f`,
        )
    }
    await git(repo, argv, extraEnv)
}
