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
import * as telemetryRepo from '@/server/data/repositories/telemetry-repo'
import * as searchRepo from '@/server/data/repositories/search-repo'
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

export function projectNotesDir(project: string): string {
    return path.join(projectPath(project), 'notes')
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
                // `logs/` and dotfiles (.status/.lock/.warm_session) are not tasks;
                // `archive/` holds archived done tasks (A5), outside the queue.
                if (entry.name.startsWith('.') || entry.name === 'logs') return
                if (!prefix && entry.name === ARCHIVE_DIR) return
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

export async function writeTaskFile(project: string, id: string, content: string): Promise<void> {
    const file = resolveWithin(projectTasksDir(project), id)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, content, 'utf8')
    searchRepo.indexDoc(project, 'task', id, extractTitle(content, id), content)
}

/** Delete a task file (A3 bulk delete) + its DB/index rows. No-op if absent. */
export async function deleteTaskFile(project: string, id: string): Promise<void> {
    const file = resolveWithin(projectTasksDir(project), id)
    try {
        await fs.unlink(file)
    } catch {
        /* already absent */
    }
    searchRepo.removeDoc(project, 'task', id)
}

// ── task parsing (mirrors executor.sh task_facet / title extraction) ─────────

export interface ParsedTask {
    title: string
    status: TaskStatus
    severity?: string
    project?: string
    /** Pinned per-task model (`**Model:**` facet) — overrides the run model (§9). */
    model?: string
    /** Pinned per-task Claude identity (`**Account:**` facet) — alias into the account registry. */
    account?: string
    /** A4 — task ids / number prefixes this task depends on (`**Depends:**` facet). */
    depends?: string[]
    /** E2 — provenance facet (`**Source:** github#123`) for imported issues. */
    source?: string
    /** Last failure recorded onto the task file when it errored (durable; survives telemetry pruning). */
    error?: string
}

export function parseTask(content: string, id: string): ParsedTask {
    const title = extractTitle(content, id)
    const status = (extractField(content, 'status')?.toLowerCase() as TaskStatus) || 'open'
    const severity = facet(content, id, 'severity', 'priority')
    const project = facet(content, id, 'project', 'tags')
    const model = facet(content, id, 'model', 'model')
    const account = facet(content, id, 'account', 'account')
    const dependsRaw = extractField(content, 'depends')
    const depends = dependsRaw
        ? dependsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
        : undefined
    const source = extractField(content, 'source')
    const error = extractField(content, 'error')
    return {
        title,
        status: status === 'done' || status === 'error' ? status : 'open',
        severity,
        project,
        model,
        account,
        depends: depends?.length ? depends : undefined,
        source: source || undefined,
        error: error || undefined,
    }
}

/**
 * A4 — does dependency `dep` point at task `taskId`? Matches the exact id, the
 * basename, or a numeric prefix ("003" matches `003-add-feature.md`).
 */
export function dependencyMatches(dep: string, taskId: string): boolean {
    if (dep === taskId) return true
    const base = taskId.split('/').pop() || taskId
    if (dep === base || dep === base.replace(/\.md$/i, '')) return true
    if (/^\d+$/.test(dep)) {
        const m = base.match(/^(\d+)/)
        if (m && Number(m[1]) === Number(dep)) return true
    }
    return false
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

/**
 * Insert/replace (or, when `model` is null, remove) the `**Model:**` header,
 * anchored after the `**Status:**` line (else the H1) — same surgery pattern as
 * the error header.
 */
function setModelHeader(content: string, model: string | null): string {
    const re = /^\s*\*{0,2}model\*{0,2}\s*:\s*.*$/im
    if (model === null) {
        return content.replace(/(?:^|\n)\s*\*{0,2}model\*{0,2}\s*:\s*.*(?=\n|$)/i, '')
    }
    const line = `**Model:** ${model}`
    if (re.test(content)) {
        return content.replace(re, line)
    }
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
 * Pin (or clear, with null) a task's preferred model: rewrite the `**Model:**`
 * header in the markdown, then re-sync the DB row from the file so both stay
 * in agreement.
 */
export async function updateTaskModel(project: string, id: string, model: string | null): Promise<void> {
    const content = await readTaskFile(project, id)
    const next = setModelHeader(content, model)
    await writeTaskFile(project, id, next)
    try {
        const stat = await fs.stat(resolveWithin(projectTasksDir(project), id))
        taskRepo.syncTask(project, id, parseTask(next, id), Math.floor(stat.mtimeMs))
    } catch {
        /* DB mirror catches up on the next reconcile */
    }
}

// ── manual task creation / editing (A1) ───────────────────────────────────────

const TASK_SLUG_RE = /[^a-z0-9]+/g

/** Next zero-padded task number, counting active AND archived files (A5 keeps numbers monotonic). */
export async function nextTaskNumber(project: string): Promise<number> {
    const [active, archived] = await Promise.all([
        listTaskFiles(project),
        listArchivedTaskFiles(project).catch(() => [] as string[]),
    ])
    let max = 0
    for (const f of [...active, ...archived]) {
        const base = f.split('/').pop() || f
        const m = base.match(/^(\d+)/)
        if (m) max = Math.max(max, Number(m[1]))
    }
    return max + 1
}

export interface CreateTaskInput {
    title: string
    body: string
    severity?: string
    project?: string
    model?: string
    account?: string
    depends?: string[]
    /** E2 — provenance facet, e.g. `github#123`. */
    source?: string
}

/** Assemble + write a numbered task file; returns its id. */
export async function createTask(project: string, input: CreateTaskInput): Promise<string> {
    const n = await nextTaskNumber(project)
    const slug =
        input.title
            .toLowerCase()
            .replace(TASK_SLUG_RE, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'task'
    const id = `${String(n).padStart(3, '0')}-${slug}.md`

    const lines = [`# ${input.title.trim()}`, '', '**Status:** open']
    if (input.severity) lines.push(`**Severity:** ${input.severity}`)
    if (input.project) lines.push(`**Project:** ${input.project}`)
    if (input.model) lines.push(`**Model:** ${input.model}`)
    if (input.account) lines.push(`**Account:** ${input.account}`)
    if (input.depends?.length) lines.push(`**Depends:** ${input.depends.join(', ')}`)
    if (input.source) lines.push(`**Source:** ${input.source}`)
    lines.push('', input.body.trim(), '')

    await writeTaskFile(project, id, lines.join('\n'))
    await syncOneTask(project, id)
    return id
}

/**
 * A1 — replace a task's markdown body from the editor. The `**Status:**` (and,
 * when errored, `**Error:**`) headers are server-owned: whatever the editor
 * submitted is rewritten from the DB row, so an edit can't flip runtime state.
 */
export async function editTaskContent(project: string, id: string, content: string): Promise<void> {
    const row = taskRepo.getTask(project, id)
    const status: TaskStatus = row?.status ?? parseTask(content, id).status
    let next = setStatusHeader(content, status)
    next = setErrorHeader(next, status === 'error' && row?.error ? row.error : null)
    await writeTaskFile(project, id, next)
    await syncOneTask(project, id)
}

/** Re-parse one file into its DB row (used after targeted writes). */
async function syncOneTask(project: string, id: string): Promise<void> {
    try {
        const stat = await fs.stat(resolveWithin(projectTasksDir(project), id))
        const content = await readTaskFile(project, id)
        taskRepo.syncTask(project, id, parseTask(content, id), Math.floor(stat.mtimeMs))
    } catch {
        /* reconcile catches up later */
    }
}

// ── task reordering (A2) ──────────────────────────────────────────────────────

export class ReorderError extends Error {}

/**
 * Renumber-on-reorder: `orderedIds` is the full set of OPEN (pending) tasks in
 * their new order. The multiset of their existing numeric prefixes is sorted
 * ascending and reassigned in the new order, so done/error tasks keep their
 * numbers and history stays intact. Two-phase rename avoids collisions.
 * Returns the old→new id mapping.
 */
export async function reorderPendingTasks(
    project: string,
    orderedIds: string[],
): Promise<Record<string, string>> {
    const open = new Set(
        taskRepo
            .listTasks(project)
            .filter((t) => t.status === 'open')
            .map((t) => t.id),
    )
    if (orderedIds.length !== open.size || orderedIds.some((id) => !open.has(id))) {
        throw new ReorderError('orderedIds must be exactly the set of pending tasks')
    }

    interface Slot {
        id: string
        dir: string
        prefix: number
        rest: string
    }
    const slots: Slot[] = orderedIds.map((id) => {
        const dir = id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : ''
        const base = id.split('/').pop() || id
        const m = base.match(/^(\d+)(.*)$/)
        if (!m) throw new ReorderError(`task has no numeric prefix: ${id}`)
        return { id, dir, prefix: Number(m[1]), rest: m[2] }
    })

    const numbers = slots.map((s) => s.prefix).sort((a, b) => a - b)
    const width = Math.max(3, ...numbers.map((n) => String(n).length))

    const renames: { from: string; to: string }[] = []
    for (let i = 0; i < slots.length; i++) {
        const s = slots[i]
        const newBase = `${String(numbers[i]).padStart(width, '0')}${s.rest}`
        const to = s.dir ? `${s.dir}/${newBase}` : newBase
        if (to !== s.id) renames.push({ from: s.id, to })
    }
    if (renames.length === 0) return {}

    const base = projectTasksDir(project)
    // phase 1: move to temp names (avoids A→B while B→A collisions)
    await Promise.all(
        renames.map(({ from }, idx) =>
            fs.rename(resolveWithin(base, from), path.join(base, `.reorder-tmp-${idx}`)),
        ),
    )
    // phase 2: temp → final
    await Promise.all(
        renames.map(async ({ to }, idx) => {
            const target = resolveWithin(base, to)
            await fs.mkdir(path.dirname(target), { recursive: true })
            await fs.rename(path.join(base, `.reorder-tmp-${idx}`), target)
        }),
    )

    const mapping: Record<string, string> = {}
    for (const { from, to } of renames) {
        mapping[from] = to
        telemetryRepo.renameTask(project, from, to)
        searchRepo.removeDoc(project, 'task', from)
    }
    await reconcileTasks(project)
    return mapping
}

// ── archive (A5) ──────────────────────────────────────────────────────────────

const ARCHIVE_DIR = 'archive'

/** Recursively list `*.md` files under `tasks/archive/`, as archive-relative ids. */
export async function listArchivedTaskFiles(project: string): Promise<string[]> {
    const base = path.join(projectTasksDir(project), ARCHIVE_DIR)
    if (!(await exists(base))) return []
    const out: string[] = []
    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
        await Promise.all(
            entries.map(async (entry) => {
                if (entry.name.startsWith('.')) return
                const rel = prefix ? `${prefix}/${entry.name}` : entry.name
                if (entry.isDirectory()) await walk(path.join(dir, entry.name), rel)
                else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) out.push(rel)
            }),
        )
    }
    await walk(base, '')
    return out.sort((a, b) => a.localeCompare(b))
}

/** Move every done task file into `tasks/archive/`; returns the moved ids. */
export async function archiveDoneTasks(project: string): Promise<string[]> {
    const done = taskRepo
        .listTasks(project)
        .filter((t) => t.status === 'done')
        .map((t) => t.id)
    const base = projectTasksDir(project)
    const moved: string[] = []
    for (const id of done) {
        const from = resolveWithin(base, id)
        const to = resolveWithin(path.join(base, ARCHIVE_DIR), id)
        try {
            await fs.mkdir(path.dirname(to), { recursive: true })
            await fs.rename(from, to)
            moved.push(id)
            searchRepo.removeDoc(project, 'task', id)
        } catch {
            /* skip un-movable file; queue stays consistent via reconcile */
        }
    }
    await reconcileTasks(project) // prunes the moved rows
    return moved
}

/** Move one archived task back into the active queue (keeps its done header). */
export async function restoreArchivedTask(project: string, id: string): Promise<void> {
    const base = projectTasksDir(project)
    const from = resolveWithin(path.join(base, ARCHIVE_DIR), id)
    const to = resolveWithin(base, id)
    try {
        await fs.access(to)
        throw new ReorderError(`an active task already uses ${id}`)
    } catch (e) {
        if (e instanceof ReorderError) throw e
        /* target free */
    }
    await fs.mkdir(path.dirname(to), { recursive: true })
    await fs.rename(from, to)
    await reconcileTasks(project)
}

export async function readArchivedTaskFile(project: string, id: string): Promise<string> {
    const file = resolveWithin(path.join(projectTasksDir(project), ARCHIVE_DIR), id)
    return fs.readFile(file, 'utf8')
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
                const content = await readTaskFile(project, id)
                const parsed = parseTask(content, id)
                taskRepo.syncTask(project, id, parsed, mtimeMs)
                searchRepo.indexDoc(project, 'task', id, parsed.title, content)
            } catch {
                /* skip unreadable file */
            }
        }),
    )
    const removed = taskRepo.pruneMissing(project, ids)
    for (const id of removed) searchRepo.removeDoc(project, 'task', id)
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
    searchRepo.indexDoc(project, 'knowledge', id, extractTitle(content, id), content)
}

/** Delete a knowledge doc. No-op if it does not exist. */
export async function deleteKnowledgeFile(project: string, id: string): Promise<void> {
    const file = resolveWithin(projectKnowledgeDir(project), id)
    try {
        await fs.unlink(file)
    } catch {
        /* already absent */
    }
    searchRepo.removeDoc(project, 'knowledge', id)
}

/** C3 — (re)index every knowledge doc (post agent-session sync point). */
export async function reindexKnowledge(project: string): Promise<void> {
    const ids = await listKnowledgeFiles(project)
    await Promise.all(
        ids.map(async (id) => {
            try {
                const content = await readKnowledgeFile(project, id)
                searchRepo.indexDoc(project, 'knowledge', id, extractTitle(content, id), content)
            } catch {
                /* skip unreadable */
            }
        }),
    )
}

/** True once the entry-point `index.md` has been generated. */
export async function knowledgeExists(project: string): Promise<boolean> {
    return exists(path.join(projectKnowledgeDir(project), 'index.md'))
}

// ── notes (project-root notes/) ────────────────────────────────────────────────
// Free-form user scratchpads, editable manually or by the note-writer agent.
// Sibling of repo/, tasks/, knowledge/ — outside repo/, never committed. No
// app-owned index file: the list view is the index. Same path-safe IO pattern.

/** Recursively list `*.md` files under the project's `notes/`, sorted, as notes-relative ids. */
export async function listNoteFiles(project: string): Promise<string[]> {
    const base = projectNotesDir(project)
    if (!(await exists(base))) return []
    const out: string[] = []

    async function walk(dir: string, prefix: string): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true })
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
    return out.sort((a, b) => a.localeCompare(b))
}

export async function readNoteFile(project: string, id: string): Promise<string> {
    const file = resolveWithin(projectNotesDir(project), id)
    return fs.readFile(file, 'utf8')
}

/** Create or overwrite a note. Lazily creates `notes/` for pre-existing projects. */
export async function writeNoteFile(project: string, id: string, content: string): Promise<void> {
    const file = resolveWithin(projectNotesDir(project), id)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, content, 'utf8')
    searchRepo.indexDoc(project, 'note', id, extractTitle(content, id), content)
}

/** Delete a note. No-op if it does not exist. */
export async function deleteNoteFile(project: string, id: string): Promise<void> {
    const file = resolveWithin(projectNotesDir(project), id)
    try {
        await fs.unlink(file)
    } catch {
        /* already absent */
    }
    searchRepo.removeDoc(project, 'note', id)
}

/** C3 — (re)index every note (post agent-session sync point). */
export async function reindexNotes(project: string): Promise<void> {
    const ids = await listNoteFiles(project)
    await Promise.all(
        ids.map(async (id) => {
            try {
                const content = await readNoteFile(project, id)
                searchRepo.indexDoc(project, 'note', id, extractTitle(content, id), content)
            } catch {
                /* skip unreadable */
            }
        }),
    )
}

/** ISO mtime of a note file (for the list's relative-time display). */
export async function noteUpdatedAt(project: string, id: string): Promise<string> {
    const file = resolveWithin(projectNotesDir(project), id)
    const stat = await fs.stat(file)
    return stat.mtime.toISOString()
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
