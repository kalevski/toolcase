// C1 prompt history + template library — SQL for `agent_prompt_history`
// (append-only, per project+agent) and `prompt_template` (global, named).
// The `agent_prompt` UPSERT table stays as the fast "latest" lookup.

import 'server-only'
import { prep, allRows } from '@/server/data/db'
import type { AgentKind } from '@/server/domain/types'

export interface PromptHistoryEntry {
    id: number
    prompt: string
    model: string
    usedAt: string
}

export interface PromptTemplate {
    id: number
    name: string
    agent: AgentKind
    prompt: string
    createdAt: string
}

export function append(project: string, agent: AgentKind, prompt: string, model: string): void {
    prep(
        `INSERT INTO agent_prompt_history (project, agent, prompt, model, used_at)
         VALUES (?, ?, ?, ?, ?)`,
    ).run(project, agent, prompt, model, new Date().toISOString())
}

export function history(project: string, agent: AgentKind, limit = 20): PromptHistoryEntry[] {
    return allRows<{ id: number; prompt: string; model: string; used_at: string }>(
        `SELECT id, prompt, model, used_at FROM agent_prompt_history
         WHERE project = ? AND agent = ? ORDER BY id DESC LIMIT ?`,
        project,
        agent,
        limit,
    ).map((r) => ({ id: r.id, prompt: r.prompt, model: r.model, usedAt: r.used_at }))
}

// ── templates (global, cross-project) ────────────────────────────────────────

export function saveTemplate(name: string, agent: AgentKind, prompt: string): PromptTemplate {
    const res = prep(
        `INSERT INTO prompt_template (name, agent, prompt, created_at) VALUES (?, ?, ?, ?)`,
    ).run(name, agent, prompt, new Date().toISOString())
    return { id: Number(res.lastInsertRowid), name, agent, prompt, createdAt: new Date().toISOString() }
}

export function listTemplates(agent?: AgentKind): PromptTemplate[] {
    const rows = agent
        ? allRows<{ id: number; name: string; agent: string; prompt: string; created_at: string }>(
              'SELECT id, name, agent, prompt, created_at FROM prompt_template WHERE agent = ? ORDER BY name',
              agent,
          )
        : allRows<{ id: number; name: string; agent: string; prompt: string; created_at: string }>(
              'SELECT id, name, agent, prompt, created_at FROM prompt_template ORDER BY name',
          )
    return rows.map((r) => ({ id: r.id, name: r.name, agent: r.agent, prompt: r.prompt, createdAt: r.created_at }))
}

export function deleteTemplate(id: number): void {
    prep('DELETE FROM prompt_template WHERE id = ?').run(id)
}
