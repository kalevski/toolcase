// Safe filesystem access for the workspace (§3, §10).
// All repo / task / skill names are validated against a strict charset and the
// resolved absolute path is asserted to live inside its base directory before
// any IO, defeating path traversal.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config'
import type { SkillSummary, TaskStatus } from './types'

// ── path safety ──────────────────────────────────────────────────────────────

const SEGMENT_RE = /^[A-Za-z0-9._-]+$/
const SKILL_RE = /^[a-z0-9-]+$/

export class UnsafePathError extends Error {}

/** Validate a single path segment (repo name, task file name, …). */
export function assertSafeSegment(name: string): void {
    if (!name || !SEGMENT_RE.test(name) || name === '.' || name === '..') {
        throw new UnsafePathError(`Invalid name: ${JSON.stringify(name)}`)
    }
}

export function assertSafeSkillName(name: string): void {
    if (!name || !SKILL_RE.test(name)) {
        throw new UnsafePathError(`Invalid skill name: ${JSON.stringify(name)}`)
    }
}

/**
 * Resolve `rel` (which may contain `/` for nested task files) inside `base`,
 * validating every segment and asserting the result stays within `base`.
 */
export function resolveWithin(base: string, rel: string): string {
    const segments = rel.split('/').filter((s) => s.length > 0)
    for (const seg of segments) assertSafeSegment(seg)
    const resolved = path.resolve(base, segments.join('/'))
    const baseResolved = path.resolve(base)
    if (resolved !== baseResolved && !resolved.startsWith(baseResolved + path.sep)) {
        throw new UnsafePathError(`Path escapes base: ${rel}`)
    }
    return resolved
}

// ── directory helpers ────────────────────────────────────────────────────────

export function repoPath(repo: string): string {
    assertSafeSegment(repo)
    return path.join(config.reposDir, repo)
}

export function repoTasksDir(repo: string): string {
    assertSafeSegment(repo)
    return path.join(config.tasksDir, repo)
}

async function exists(p: string): Promise<boolean> {
    try {
        await fs.access(p)
        return true
    } catch {
        return false
    }
}

async function ensureDir(p: string): Promise<void> {
    await fs.mkdir(p, { recursive: true })
}

/** List repository directory names under `/workspace/repos`. */
export async function listRepos(): Promise<string[]> {
    if (!(await exists(config.reposDir))) return []
    const entries = await fs.readdir(config.reposDir, { withFileTypes: true })
    return entries
        .filter((e) => e.isDirectory() && SEGMENT_RE.test(e.name))
        .map((e) => e.name)
        .sort()
}

export async function repoExists(repo: string): Promise<boolean> {
    try {
        const stat = await fs.stat(repoPath(repo))
        return stat.isDirectory()
    } catch {
        return false
    }
}

// ── task discovery ─────────────────────────────────────────────────────────

/** Recursively list `*.md` task files under `tasks/<repo>/`, sorted, as repo-relative ids. */
export async function listTaskFiles(repo: string): Promise<string[]> {
    const base = repoTasksDir(repo)
    if (!(await exists(base))) return []
    const out: string[] = []

    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
            // `logs/` and dotfiles (.status/.lock/.warm_session) are not tasks.
            if (entry.name.startsWith('.') || entry.name === 'logs') continue
            const rel = prefix ? `${prefix}/${entry.name}` : entry.name
            if (entry.isDirectory()) {
                await walk(path.join(dir, entry.name), rel)
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                // PROMPT.md is the per-repo preamble override, not a task.
                if (entry.name === 'PROMPT.md') continue
                out.push(rel)
            }
        }
    }

    await walk(base, '')
    return out.sort((a, b) => a.localeCompare(b))
}

export async function readTaskFile(repo: string, id: string): Promise<string> {
    const file = resolveWithin(repoTasksDir(repo), id)
    return fs.readFile(file, 'utf8')
}

export async function writeTaskFile(repo: string, id: string, content: string): Promise<void> {
    const file = resolveWithin(repoTasksDir(repo), id)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, content, 'utf8')
}

// ── task parsing (mirrors executor.sh task_facet / title extraction) ─────────

export interface ParsedTask {
    title: string
    status: TaskStatus
    severity?: string
    project?: string
}

export function parseTask(content: string, id: string): ParsedTask {
    const title = extractTitle(content, id)
    const status = (extractField(content, 'status')?.toLowerCase() as TaskStatus) || 'open'
    const severity = facet(content, id, 'severity', 'priority')
    const project = facet(content, id, 'project', 'tags')
    return {
        title,
        status: status === 'done' || status === 'error' ? status : 'open',
        severity,
        project,
    }
}

function extractTitle(content: string, id: string): string {
    const m = content.match(/^#\s+(.+?)\s*$/m)
    if (m) return m[1].trim()
    const base = id.split('/').pop() || id
    return base.replace(/\.md$/i, '')
}

/** Read `**Field:** value` (bold list) or `Field: value`. */
function extractField(content: string, field: string): string | undefined {
    const re = new RegExp(`^\\s*\\*{0,2}${field}\\*{0,2}\\s*:\\s*\\*{0,2}\\s*(.+?)\\s*\\*{0,2}\\s*$`, 'im')
    const m = content.match(re)
    return m ? m[1].trim() : undefined
}

/** YAML frontmatter fallback for a key (`priority:` / `tags:`). */
function frontmatterField(content: string, key: string): string | undefined {
    const fm = content.match(/^---\n([\s\S]*?)\n---/)
    if (!fm) return undefined
    const re = new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, 'im')
    const m = fm[1].match(re)
    if (!m) return undefined
    return m[1]
        .replace(/^\[|\]$/g, '')
        .split(',')[0]
        .trim()
}

function facet(content: string, id: string, field: string, fmKey: string): string | undefined {
    const direct = extractField(content, field)
    if (direct) return direct.toLowerCase()
    const fm = frontmatterField(content, fmKey)
    if (fm) return fm.toLowerCase()
    // Severity may be encoded in the filename, e.g. `016-high-fix.md`.
    if (field === 'severity') {
        const base = (id.split('/').pop() || id).toLowerCase()
        const m = base.match(/^\d+-(low|medium|high|critical)-/)
        if (m) return m[1]
    }
    return undefined
}

/** Replace (or insert) the `**Status:**` header, returning the new content. */
export function setStatusHeader(content: string, status: TaskStatus): string {
    const re = /^(\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*)(open|done|error)(\s*\*{0,2}\s*)$/im
    if (re.test(content)) {
        return content.replace(re, `$1${status}$3`)
    }
    // Insert after the first H1, else prepend.
    const h1 = content.match(/^#\s+.+$/m)
    if (h1 && h1.index !== undefined) {
        const insertAt = h1.index + h1[0].length
        return content.slice(0, insertAt) + `\n\n**Status:** ${status}` + content.slice(insertAt)
    }
    return `**Status:** ${status}\n\n` + content
}

export async function updateTaskStatus(repo: string, id: string, status: TaskStatus): Promise<void> {
    const content = await readTaskFile(repo, id)
    await writeTaskFile(repo, id, setStatusHeader(content, status))
}

// ── .status (completion ledger) ───────────────────────────────────────────────

function statusFilePath(repo: string): string {
    return path.join(repoTasksDir(repo), '.status')
}

export async function readCompleted(repo: string): Promise<Set<string>> {
    const file = statusFilePath(repo)
    try {
        const raw = await fs.readFile(file, 'utf8')
        return new Set(
            raw
                .split('\n')
                .map((l) => l.trim())
                .filter(Boolean),
        )
    } catch {
        return new Set()
    }
}

export async function appendCompleted(repo: string, id: string): Promise<void> {
    const file = statusFilePath(repo)
    await ensureDir(path.dirname(file))
    const done = await readCompleted(repo)
    if (done.has(id)) return
    await fs.appendFile(file, id + '\n', 'utf8')
}

export async function clearCompleted(repo: string): Promise<void> {
    const file = statusFilePath(repo)
    try {
        await fs.unlink(file)
    } catch {
        /* already absent */
    }
}

// ── PROMPT.md override ────────────────────────────────────────────────────────

export async function readRepoPromptOverride(repo: string): Promise<string | null> {
    const file = path.join(repoTasksDir(repo), 'PROMPT.md')
    try {
        return await fs.readFile(file, 'utf8')
    } catch {
        return null
    }
}

// ── warm session marker ───────────────────────────────────────────────────────

const WARM_FILE = '.warm_session'

export async function readWarmSession(repo: string): Promise<{ sessionId: string; ts: number } | null> {
    const file = path.join(repoTasksDir(repo), WARM_FILE)
    try {
        const raw = await fs.readFile(file, 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.sessionId === 'string' && typeof parsed.ts === 'number') {
            return parsed
        }
    } catch {
        /* none */
    }
    return null
}

export async function writeWarmSession(repo: string, sessionId: string, ts: number): Promise<void> {
    const file = path.join(repoTasksDir(repo), WARM_FILE)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, JSON.stringify({ sessionId, ts }), 'utf8')
}

export async function clearWarmSession(repo: string): Promise<void> {
    const file = path.join(repoTasksDir(repo), WARM_FILE)
    try {
        await fs.unlink(file)
    } catch {
        /* none */
    }
}

// ── skills ────────────────────────────────────────────────────────────────────

function skillDir(name: string): string {
    assertSafeSkillName(name)
    return path.join(config.skillsDir, name)
}

function skillFile(name: string): string {
    return path.join(skillDir(name), 'SKILL.md')
}

export function parseSkillFrontmatter(raw: string): { name?: string; description?: string } {
    const fm = raw.match(/^---\n([\s\S]*?)\n---/)
    if (!fm) return {}
    const body = fm[1]
    const name = body.match(/^\s*name\s*:\s*(.+?)\s*$/im)?.[1]
    const description = body.match(/^\s*description\s*:\s*(.+?)\s*$/im)?.[1]
    return {
        name: name?.replace(/^["']|["']$/g, ''),
        description: description?.replace(/^["']|["']$/g, ''),
    }
}

export async function listSkills(): Promise<SkillSummary[]> {
    if (!(await exists(config.skillsDir))) return []
    const entries = await fs.readdir(config.skillsDir, { withFileTypes: true })
    const out: SkillSummary[] = []
    for (const entry of entries) {
        if (!entry.isDirectory() || !SKILL_RE.test(entry.name)) continue
        const file = path.join(config.skillsDir, entry.name, 'SKILL.md')
        if (!(await exists(file))) continue
        const raw = await fs.readFile(file, 'utf8')
        const fm = parseSkillFrontmatter(raw)
        out.push({ name: entry.name, description: fm.description || '' })
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
}

export async function readSkill(name: string): Promise<string> {
    return fs.readFile(skillFile(name), 'utf8')
}

export async function skillExists(name: string): Promise<boolean> {
    return exists(skillFile(name))
}

export async function writeSkill(name: string, content: string): Promise<void> {
    await ensureDir(skillDir(name))
    await fs.writeFile(skillFile(name), content, 'utf8')
}

export async function deleteSkill(name: string): Promise<void> {
    await fs.rm(skillDir(name), { recursive: true, force: true })
}

// ── auth dir bootstrap ──────────────────────────────────────────────────────

export async function ensureAuthDir(): Promise<void> {
    await ensureDir(config.authDir)
}
