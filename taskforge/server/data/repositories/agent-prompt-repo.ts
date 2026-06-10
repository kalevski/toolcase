// Latest prompt per (project, agent) — all SQL for the `agent_prompt` table.
// One UPSERT row per pair: the composer's "last prompt" strip reads it, and the
// session manager writes it on every accepted start (so it always reflects the
// last real run, shared across browsers/users).

import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { AgentKind, AgentPromptRecord } from '@/server/domain/types'

interface Raw {
    agent: string
    prompt: string
    model: string
    used_at: string
}

export function saveLatest(project: string, agent: AgentKind, prompt: string, model: string): void {
    prep(
        `INSERT INTO agent_prompt (project, agent, prompt, model, used_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(project, agent) DO UPDATE SET
            prompt  = excluded.prompt,
            model   = excluded.model,
            used_at = excluded.used_at`,
    ).run(project, agent, prompt, model, new Date().toISOString())
}

export function getLatest(project: string, agent: AgentKind): AgentPromptRecord | null {
    const r = getRow<Raw>(
        'SELECT agent, prompt, model, used_at FROM agent_prompt WHERE project = ? AND agent = ?',
        project,
        agent,
    )
    return r ? { prompt: r.prompt, model: r.model, usedAt: r.used_at } : null
}

export function getAll(project: string): Partial<Record<AgentKind, AgentPromptRecord>> {
    const rows = allRows<Raw>('SELECT agent, prompt, model, used_at FROM agent_prompt WHERE project = ?', project)
    const out: Partial<Record<AgentKind, AgentPromptRecord>> = {}
    for (const r of rows) {
        out[r.agent as AgentKind] = { prompt: r.prompt, model: r.model, usedAt: r.used_at }
    }
    return out
}
