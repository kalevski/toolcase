// C4 custom agent kinds — all SQL for the `agent_def` table. The three bundled
// kinds are NOT stored here; this table holds only admin-defined extras.

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import { AGENT_KINDS, type AgentDef, type AgentPost } from '@/server/domain/types'

const KIND_RE = /^[a-z0-9][a-z0-9-]{1,40}$/
const TARGETS = new Set(['repo', 'tasks', 'knowledge', 'notes', 'project'])
const POSTS = new Set<AgentPost>(['none', 'tasks', 'knowledge', 'notes'])

export class InvalidAgentDefError extends Error {}

interface Raw {
    kind: string
    label: string
    prompt_preamble: string
    target: string
    post: string
    created_at: string
}

function map(r: Raw): AgentDef {
    return {
        kind: r.kind,
        label: r.label,
        promptPreamble: r.prompt_preamble,
        target: r.target as AgentDef['target'],
        post: r.post as AgentPost,
        createdAt: r.created_at,
    }
}

export function validate(def: Omit<AgentDef, 'createdAt'>): void {
    if (!KIND_RE.test(def.kind)) {
        throw new InvalidAgentDefError('kind must be kebab-case (a-z, 0-9, dashes), 2–41 chars')
    }
    if ((AGENT_KINDS as string[]).includes(def.kind)) {
        throw new InvalidAgentDefError(`"${def.kind}" is a bundled agent kind`)
    }
    if (!def.label.trim()) throw new InvalidAgentDefError('label required')
    if (!TARGETS.has(def.target)) throw new InvalidAgentDefError(`invalid target: ${def.target}`)
    if (!POSTS.has(def.post)) throw new InvalidAgentDefError(`invalid post: ${def.post}`)
}

export function upsert(def: Omit<AgentDef, 'createdAt'>): AgentDef {
    validate(def)
    prep(
        `INSERT INTO agent_def (kind, label, prompt_preamble, target, post, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(kind) DO UPDATE SET
            label = excluded.label,
            prompt_preamble = excluded.prompt_preamble,
            target = excluded.target,
            post = excluded.post`,
    ).run(def.kind, def.label.trim(), def.promptPreamble, def.target, def.post, new Date().toISOString())
    return get(def.kind)!
}

export function get(kind: string): AgentDef | null {
    const r = getRow<Raw>('SELECT * FROM agent_def WHERE kind = ?', kind)
    return r ? map(r) : null
}

export function list(): AgentDef[] {
    return allRows<Raw>('SELECT * FROM agent_def ORDER BY kind').map(map)
}

export function remove(kind: string): void {
    prep('DELETE FROM agent_def WHERE kind = ?').run(kind)
}
