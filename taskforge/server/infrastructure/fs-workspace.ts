// Safe filesystem access for the workspace (§3, §10).
// All repo / task / skill names are validated against a strict charset and the
// resolved absolute path is asserted to live inside its base directory before
// any IO, defeating path traversal.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import * as taskRepo from '@/server/data/repositories/task-repo'
import * as warmRepo from '@/server/data/repositories/warm-session-repo'
import type { SkillSummary, TaskStatus } from '@/server/domain/types'

// ── path safety ──────────────────────────────────────────────────────────────

const SEGMENT_RE = /^[A-Za-z0-9._-]+$/
const SKILL_RE = /^[a-z0-9-]+$/

export class UnsafePathError extends Error {}

/** Validate a single path segment (repo name, task file name, …). */
function assertSafeSegment(name: string): void {
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
function resolveWithin(base: string, rel: string): string {
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
// A project is one self-contained folder; the agent runs at `projectPath` so
// every subfolder (repo/, tasks/, knowledge/) is inside its sandbox.

/** Project root — the agent's cwd for runs. */
export function projectPath(project: string): string {
    assertSafeSegment(project)
    return path.join(config.projectsDir, project)
}

/** The cloned git repository — git's cwd; all code changes land here. */
export function projectRepoDir(project: string): string {
    return path.join(projectPath(project), 'repo')
}

export function projectTasksDir(project: string): string {
    return path.join(projectPath(project), 'tasks')
}

export function projectKnowledgeDir(project: string): string {
    return path.join(projectPath(project), 'knowledge')
}

/** `.claude/skills` inside the project — a symlink to the shared skills dir. */
export function projectSkillsLink(project: string): string {
    return path.join(projectPath(project), '.claude', 'skills')
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

/** List project directory names under `/workspace/projects`. */
export async function listProjects(): Promise<string[]> {
    if (!(await exists(config.projectsDir))) return []
    const entries = await fs.readdir(config.projectsDir, { withFileTypes: true })
    return entries
        .flatMap((e) => (e.isDirectory() && SEGMENT_RE.test(e.name) ? [e.name] : []))
        .sort()
}

export async function projectExists(project: string): Promise<boolean> {
    try {
        const stat = await fs.stat(projectPath(project))
        return stat.isDirectory()
    } catch {
        return false
    }
}

// ── task discovery ─────────────────────────────────────────────────────────

/** Recursively list `*.md` task files under the project's `tasks/`, sorted, as project-relative ids. */
export async function listTaskFiles(project: string): Promise<string[]> {
    const base = projectTasksDir(project)
    if (!(await exists(base))) return []
    const out: string[] = []

    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        // Subdirectories are walked concurrently; `out` is sorted below, so the
        // nondeterministic push order does not affect the result.
        await Promise.all(
            entries.map(async (entry) => {
                // `logs/` and dotfiles (.status/.lock/.warm_session) are not tasks.
                if (entry.name.startsWith('.') || entry.name === 'logs') return
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name
                if (entry.isDirectory()) {
                    await walk(path.join(dir, entry.name), rel)
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                    // PROMPT.md is the per-project preamble override, not a task.
                    if (entry.name === 'PROMPT.md') return
                    out.push(rel)
                }
            }),
        )
    }

    await walk(base, '')
    return out.sort((a, b) => a.localeCompare(b))
}

export async function readTaskFile(project: string, id: string): Promise<string> {
    const file = resolveWithin(projectTasksDir(project), id)
    return fs.readFile(file, 'utf8')
}

async function writeTaskFile(project: string, id: string, content: string): Promise<void> {
    const file = resolveWithin(projectTasksDir(project), id)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, content, 'utf8')
}

// ── task parsing (mirrors executor.sh task_facet / title extraction) ─────────

export interface ParsedTask {
    title: string
    status: TaskStatus
    severity?: string
    project?: string
    /** Last failure recorded onto the task file when it errored (durable; survives telemetry pruning). */
    error?: string
}

export function parseTask(content: string, id: string): ParsedTask {
    const title = extractTitle(content, id)
    const status = (extractField(content, 'status')?.toLowerCase() as TaskStatus) || 'open'
    const severity = facet(content, id, 'severity', 'priority')
    const project = facet(content, id, 'project', 'tags')
    const error = extractField(content, 'error')
    return {
        title,
        status: status === 'done' || status === 'error' ? status : 'open',
        severity,
        project,
        error: error || undefined,
    }
}

export function extractTitle(content: string, id: string): string {
    const m = content.match(/^#\s+(.+?)\s*$/m)
    if (m) return m[1].trim()
    const base = id.split('/').pop() || id
    return base.replace(/\.md$/i, '')
}

/**
 * One-line summary of a knowledge doc: the first non-empty, non-heading line
 * after the H1 title (per the knowledge-writer contract). Markdown emphasis and
 * blockquote markers are stripped; falls back to '' when no summary line exists.
 */
export function extractSummary(content: string): string {
    const lines = content.split('\n')
    let seenH1 = false
    for (const raw of lines) {
        const line = raw.trim()
        if (!seenH1) {
            if (/^#\s+/.test(line)) seenH1 = true
            continue
        }
        if (!line) continue
        if (line.startsWith('#')) break // next heading before any prose — no summary
        const cleaned = line
            .replace(/^>\s*/, '') // blockquote
            .replace(/^[-*]\s+/, '') // stray list marker
            .replace(/^\*+|\*+$/g, '') // bold/italic wrappers
            .replace(/^_+|_+$/g, '')
            .trim()
        if (cleaned.length > 200) return cleaned.slice(0, 197).trimEnd() + '…'
        return cleaned
    }
    return ''
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
function setStatusHeader(content: string, status: TaskStatus): string {
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

/** Collapse a raw error to a single redacted, truncated header line. */
function errorHeaderLine(error: string): string {
    const oneLine = error.replace(/\s+/g, ' ').trim()
    const capped = oneLine.length > 300 ? oneLine.slice(0, 297).trimEnd() + '…' : oneLine
    return capped
}

/**
 * Insert/replace (or, when `error` is null, remove) the `**Error:**` header,
 * placed right after the `**Status:**` line so the failure travels with the task.
 */
function setErrorHeader(content: string, error: string | null): string {
    const re = /^\s*\*{0,2}error\*{0,2}\s*:\s*.*$/im
    if (error === null) {
        // Drop the line entirely (and a trailing blank left behind).
        return content.replace(/(?:^|\n)\s*\*{0,2}error\*{0,2}\s*:\s*.*(?=\n|$)/i, '')
    }
    const line = `**Error:** ${errorHeaderLine(error)}`
    if (re.test(content)) {
        return content.replace(re, line)
    }
    // Anchor after the status header when present, else after the H1, else prepend.
    const statusRe = /^\s*\*{0,2}status\*{0,2}\s*:\s*\*{0,2}\s*(?:open|done|error)\s*\*{0,2}\s*$/im
    const sm = content.match(statusRe)
    if (sm && sm.index !== undefined) {
        const insertAt = sm.index + sm[0].length
        return content.slice(0, insertAt) + `\n${line}` + content.slice(insertAt)
    }
    const h1 = content.match(/^#\s+.+$/m)
    if (h1 && h1.index !== undefined) {
        const insertAt = h1.index + h1[0].length
        return content.slice(0, insertAt) + `\n\n${line}` + content.slice(insertAt)
    }
    return `${line}\n\n` + content
}

/**
 * Update a task's runtime status. The DB row is authoritative for the UI; the
 * `**Status:**`/`**Error:**` markdown headers are also rewritten (best-effort) so
 * the agent and a human reading `tasks/*.md` see the same truth. When moving to
 * `error` you may pass the failure text to persist; any other status clears it.
 */
export async function updateTaskStatus(
    project: string,
    id: string,
    status: TaskStatus,
    error?: string,
): Promise<void> {
    taskRepo.setStatus(project, id, status, error)
    try {
        const content = await readTaskFile(project, id)
        let next = setStatusHeader(content, status)
        next = setErrorHeader(next, status === 'error' && error ? error : null)
        await writeTaskFile(project, id, next)
        // The header rewrite bumps mtime; record it so the next reconcile does not
        // re-parse this file purely because we just touched it.
        try {
            const stat = await fs.stat(resolveWithin(projectTasksDir(project), id))
            taskRepo.touchSyncedMtime(project, id, Math.floor(stat.mtimeMs))
        } catch {
            /* ignore */
        }
    } catch {
        /* md header is best-effort; the DB row is the source of truth */
    }
}

// ── task reconciliation (markdown files → DB metadata mirror) ──────────────────
// The markdown body stays on disk (the agent reads it); this keeps the `task`
// rows in sync with the files so the queue renders from a single query. Status is
// engine-owned: `syncTask` seeds it on INSERT only and preserves it on UPDATE.

export async function reconcileTasks(project: string): Promise<void> {
    const ids = await listTaskFiles(project)
    await Promise.all(
        ids.map(async (id) => {
            let mtimeMs: number
            try {
                mtimeMs = Math.floor((await fs.stat(resolveWithin(projectTasksDir(project), id))).mtimeMs)
            } catch {
                return
            }
            if (taskRepo.syncedMtime(project, id) === mtimeMs) return // unchanged since last sync
            try {
                const parsed = parseTask(await readTaskFile(project, id), id)
                taskRepo.syncTask(project, id, parsed, mtimeMs)
            } catch {
                /* skip unreadable file */
            }
        }),
    )
    taskRepo.pruneMissing(project, ids)
}

// ── completion ledger (DB-backed: task.status = 'done') ────────────────────────

export async function readCompleted(project: string): Promise<Set<string>> {
    return taskRepo.completedIds(project)
}

export async function appendCompleted(project: string, id: string): Promise<void> {
    taskRepo.setStatus(project, id, 'done')
}

export async function clearCompleted(project: string): Promise<void> {
    taskRepo.reopenAllDone(project)
}

/** Reopen specific finished tasks (re-run one task without disturbing the queue). */
export async function removeCompleted(project: string, ids: string[]): Promise<void> {
    taskRepo.reopen(project, ids)
}

// ── knowledge docs (project-root knowledge/) ───────────────────────────────────
// Living documentation of the project's application, grouped by business domain,
// fronted by an index.md. Lives at the project root (sibling to repo/) so the
// agent — which runs at the project root — can read it; managed through the same
// md-file + path-safe IO pattern as tasks. (Outside repo/, so not committed.)

/** Sort `index.md` first, then lexicographically. */
function knowledgeOrder(a: string, b: string): number {
    const ai = a.toLowerCase() === 'index.md' ? 0 : 1
    const bi = b.toLowerCase() === 'index.md' ? 0 : 1
    return ai !== bi ? ai - bi : a.localeCompare(b)
}

/** Recursively list `*.md` files under the project's `knowledge/`, index first, as knowledge-relative ids. */
export async function listKnowledgeFiles(project: string): Promise<string[]> {
    const base = projectKnowledgeDir(project)
    if (!(await exists(base))) return []
    const out: string[] = []

    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        // Subdirectories are walked concurrently; `out` is sorted below.
        await Promise.all(
            entries.map(async (entry) => {
                if (entry.name.startsWith('.')) return
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name
                if (entry.isDirectory()) {
                    await walk(path.join(dir, entry.name), rel)
                } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
                    out.push(rel)
                }
            }),
        )
    }

    await walk(base, '')
    return out.sort(knowledgeOrder)
}

export async function readKnowledgeFile(project: string, id: string): Promise<string> {
    const file = resolveWithin(projectKnowledgeDir(project), id)
    return fs.readFile(file, 'utf8')
}

/** Overwrite (or create) a knowledge doc — used by the app to own `index.md`. */
export async function writeKnowledgeFile(project: string, id: string, content: string): Promise<void> {
    const file = resolveWithin(projectKnowledgeDir(project), id)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content, 'utf8')
}

/** Delete a knowledge doc. No-op if it does not exist. */
export async function deleteKnowledgeFile(project: string, id: string): Promise<void> {
    const file = resolveWithin(projectKnowledgeDir(project), id)
    try {
        await fs.unlink(file)
    } catch {
        /* already absent */
    }
}

/** True once the entry-point `index.md` has been generated. */
export async function knowledgeExists(project: string): Promise<boolean> {
    return exists(path.join(projectKnowledgeDir(project), 'index.md'))
}

// ── PROMPT.md override ────────────────────────────────────────────────────────

export async function readProjectPromptOverride(project: string): Promise<string | null> {
    const file = path.join(projectTasksDir(project), 'PROMPT.md')
    try {
        return await fs.readFile(file, 'utf8')
    } catch {
        return null
    }
}

// ── warm session marker (DB-backed) ────────────────────────────────────────────

export async function readWarmSession(project: string): Promise<{ sessionId: string; ts: number } | null> {
    return warmRepo.get(project)
}

export async function writeWarmSession(project: string, sessionId: string, ts: number): Promise<void> {
    warmRepo.set(project, sessionId, ts)
}

export async function clearWarmSession(project: string): Promise<void> {
    warmRepo.clear(project)
}

// ── skills ────────────────────────────────────────────────────────────────────

function skillDir(name: string): string {
    assertSafeSkillName(name)
    return path.join(config.skillsDir, name)
}

function skillFile(name: string): string {
    return path.join(skillDir(name), 'SKILL.md')
}

function parseSkillFrontmatter(raw: string): { name?: string; description?: string } {
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
    const collected = await Promise.all(
        entries.map(async (entry) => {
            if (!entry.isDirectory() || !SKILL_RE.test(entry.name)) return null
            const file = path.join(config.skillsDir, entry.name, 'SKILL.md')
            if (!(await exists(file))) return null
            const raw = await fs.readFile(file, 'utf8')
            const fm = parseSkillFrontmatter(raw)
            return { name: entry.name, description: fm.description || '' }
        }),
    )
    return collected
        .filter((s): s is SkillSummary => s !== null)
        .sort((a, b) => a.name.localeCompare(b.name))
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
