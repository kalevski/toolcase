// Injection-safe git wrapper (§6.14–6.16, §10).
// Every call is `spawn('git', argv, { cwd })` — argv array, no shell. Ordinary
// ops run inside the project's `repo/` checkout (projectRepoDir); `clone` runs
// at the project root and creates `repo/`.

import 'server-only'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config, canPush } from '@/server/config'
import { projectPath, projectRepoDir } from '@/server/infrastructure/fs-workspace'
import { slog } from '@/server/infrastructure/server-log'
import type {
    GitBranchList,
    GitCommit,
    GitCommitDetail,
    GitStashEntry,
    GitStatus,
    GitStatusFile,
} from '@/server/domain/types'

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
const SHA_RE = /^[0-9a-f]{7,40}$/i

function assertSafeSha(sha: string): void {
    if (!SHA_RE.test(sha)) {
        throw new GitError(`Invalid commit sha: ${JSON.stringify(sha)}`, null, '')
    }
}

function assertSafeBranch(name: string): void {
    if (!BRANCH_RE.test(name) || name.includes('..')) {
        throw new GitError(`Invalid branch name: ${name}`, null, '')
    }
}

/**
 * Resolve a repo-relative file path (from `git status` output / the diff route)
 * inside the project's repo dir, rejecting traversal. Unlike task ids, repo
 * paths may contain arbitrary-but-sane segments, so this checks containment
 * rather than a charset.
 */
function resolveRepoPath(project: string, rel: string): string {
    if (!rel || rel.includes('\0') || path.isAbsolute(rel)) {
        throw new GitError(`Invalid path: ${JSON.stringify(rel)}`, null, '')
    }
    const base = path.resolve(projectRepoDir(project))
    const resolved = path.resolve(base, rel)
    if (resolved !== base && !resolved.startsWith(base + path.sep)) {
        throw new GitError(`Path escapes repository: ${rel}`, null, '')
    }
    return resolved
}

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
        // Surface git's own fatal line (last stderr line), redacted of any creds,
        // so "exit 128" becomes diagnosable (auth vs not-found vs ssh-key vs net).
        const last = res.stderr.trim().split('\n').filter(Boolean).pop() || ''
        const detail = redactGit(last) || `exit ${res.code}`
        slog('error', 'git', 'clone failed', { project, code: res.code, detail })
        throw new GitError(`git clone failed (exit ${res.code}): ${detail}`, res.code, res.stderr)
    }
}

/** Strip embedded credentials / tokens from git output before surfacing it. */
function redactGit(s: string): string {
    return s
        .replace(/(https?:\/\/)[^@\s/]+@/gi, '$1***@')
        .replace(/(ghp_|github_pat_|gho_|sk-ant-)[A-Za-z0-9_-]+/g, '«redacted»')
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
    assertSafeBranch(name)
    const branches = await git(project, ['branch', '--list', name])
    if (branches.trim() !== '') {
        await git(project, ['switch', name])
    } else {
        await git(project, ['switch', '-c', name])
    }
}

/** Switch to an existing branch (no implicit create). */
export async function switchBranch(project: string, name: string): Promise<void> {
    assertSafeBranch(name)
    await git(project, ['switch', name])
}

/** Delete a local branch (`-d`, or `-D` with force). Refuses the current branch. */
export async function deleteBranch(project: string, name: string, force = false): Promise<void> {
    assertSafeBranch(name)
    const current = await currentBranch(project)
    if (current === name) {
        throw new GitError('Cannot delete the currently checked-out branch.', null, '')
    }
    await git(project, ['branch', force ? '-D' : '-d', name])
}

/** Local + remote branch names and the current one. */
export async function listBranches(project: string): Promise<GitBranchList> {
    const current = await currentBranch(project)
    const parse = (out: string) =>
        out.split('\n').flatMap((l) => {
            const name = l.trim()
            return name && !name.includes('->') ? [name] : []
        })
    const local = parse(await git(project, ['branch', '--format=%(refname:short)']))
    let remote: string[] = []
    try {
        remote = parse(await git(project, ['branch', '-r', '--format=%(refname:short)']))
    } catch {
        /* no remotes */
    }
    return { local, remote, current }
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

// ── per-file working tree (git page §6) ──────────────────────────────────────

/** `git status --porcelain` split per file: staged (index) + unstaged codes. */
export async function statusFiles(project: string): Promise<GitStatusFile[]> {
    const out = await git(project, ['status', '--porcelain'])
    return out.split('\n').flatMap((l) => {
        if (l.length < 4) return []
        const staged = l[0].trim()
        const unstaged = l[1].trim()
        let p = l.slice(3).trim()
        // renames: "R  old -> new" — show the new path
        const arrow = p.indexOf(' -> ')
        if (arrow !== -1) p = p.slice(arrow + 4)
        // strip porcelain quoting of unusual paths
        if (p.startsWith('"') && p.endsWith('"')) p = p.slice(1, -1)
        return p ? [{ path: p, staged, unstaged }] : []
    })
}

/**
 * Discard changes to specific paths: `checkout --` restores tracked files,
 * `clean -f` removes untracked ones. Destructive (per-path).
 */
export async function discardPaths(project: string, paths: string[]): Promise<void> {
    if (paths.length === 0) return
    for (const p of paths) resolveRepoPath(project, p) // validate every path first
    const entries = await statusFiles(project)
    const untrackedSet = new Set(entries.filter((e) => e.staged === '?' || e.unstaged === '?').map((e) => e.path))
    const tracked = paths.filter((p) => !untrackedSet.has(p))
    const untracked = paths.filter((p) => untrackedSet.has(p))
    if (tracked.length) {
        // unstage first so staged-only edits are restorable, then drop the edits
        await git(project, ['reset', '-q', 'HEAD', '--', ...tracked]).catch(() => {})
        await git(project, ['checkout', '--', ...tracked])
    }
    if (untracked.length) {
        await git(project, ['clean', '-f', '--', ...untracked])
    }
}

/** Before/after content of one working-tree file vs HEAD (for the DiffViewer). */
export async function fileDiff(project: string, rel: string): Promise<{ before: string; after: string }> {
    const abs = resolveRepoPath(project, rel)
    let before = ''
    try {
        before = await git(project, ['show', `HEAD:${rel}`])
    } catch {
        /* new file — empty before */
    }
    let after = ''
    try {
        after = await fs.readFile(abs, 'utf8')
    } catch {
        /* deleted file — empty after */
    }
    return { before, after }
}

// ── commit detail / revert (§6) ─────────────────────────────────────────────

const PATCH_CAP = 100_000

/** One commit's meta + `--stat` block + patch (capped for transport). */
export async function commitDetail(project: string, sha: string): Promise<GitCommitDetail> {
    assertSafeSha(sha)
    const metaOut = await git(project, ['log', '-1', LOG_FORMAT, sha])
    const commit = parseLog(metaOut)[0]
    if (!commit) throw new GitError(`Unknown commit: ${sha}`, null, '')
    const stat = (await git(project, ['show', '--stat', '--format=', sha])).trim()
    const rawPatch = await git(project, ['show', '--format=', sha])
    const patchTruncated = rawPatch.length > PATCH_CAP
    const patch = patchTruncated ? rawPatch.slice(0, PATCH_CAP) + '\n…(truncated)…' : rawPatch
    return { commit, stat, patch, patchTruncated }
}

/** Revert one commit with a generated message. Conflicts surface as GitError (stderr). */
export async function revertCommit(project: string, sha: string): Promise<void> {
    assertSafeSha(sha)
    try {
        await git(project, ['revert', '--no-edit', sha])
    } catch (e) {
        // leave the tree clean — abort the half-applied revert before surfacing
        if (e instanceof GitError) {
            await git(project, ['revert', '--abort']).catch(() => {})
        }
        throw e
    }
}

// ── stash (§6) ──────────────────────────────────────────────────────────────

export async function stashPush(project: string, message?: string): Promise<void> {
    const argv = ['stash', 'push', '-u']
    if (message && message.trim()) argv.push('-m', message.trim())
    await git(project, argv)
}

export async function stashList(project: string): Promise<GitStashEntry[]> {
    const out = await git(project, ['stash', 'list', '--format=%gd%x1f%gs%x1f%ci'])
    return out.split('\n').flatMap((line) => {
        if (!line.trim()) return []
        const [ref, message, date] = line.split('\x1f')
        const m = ref?.match(/stash@\{(\d+)\}/)
        if (!m) return []
        return [{ index: Number(m[1]), message: message ?? '', date: date ?? '' }]
    })
}

export async function stashPop(project: string, index: number): Promise<void> {
    if (!Number.isInteger(index) || index < 0) throw new GitError(`Invalid stash index: ${index}`, null, '')
    await git(project, ['stash', 'pop', `stash@{${index}}`])
}

export async function stashDrop(project: string, index: number): Promise<void> {
    if (!Number.isInteger(index) || index < 0) throw new GitError(`Invalid stash index: ${index}`, null, '')
    await git(project, ['stash', 'drop', `stash@{${index}}`])
}
