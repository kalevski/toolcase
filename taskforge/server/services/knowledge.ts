// Knowledge base (topic-driven): the user names an aspect of the repo to
// analyze; the bundled `knowledge-writer` skill picks a filename and writes ONE
// source-anchored doc under `knowledge/`. The app owns `knowledge/index.md`,
// rebuilding it from the docs on disk after every add/remove so it always
// reflects what exists (and removal needs no markdown surgery). `updateKnowledge`
// keeps affected docs fresh after a task runs.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { runAgentOnce } from '@/server/infrastructure/agent'
import {
    listKnowledgeFiles,
    readKnowledgeFile,
    writeKnowledgeFile,
    deleteKnowledgeFile,
    extractTitle,
    extractSummary,
    projectKnowledgeDir,
    projectPath,
} from '@/server/infrastructure/fs-workspace'

const FALLBACK_BODY = [
    'You are given one topic to analyze about the repository in the `repo/` subdirectory.',
    'Pick a concise kebab-case filename `<slug>.md` and write EXACTLY ONE Markdown doc into',
    'the `knowledge/` directory at the project root (a sibling of `repo/`).',
    'Start the doc with an H1 title, then a single one-sentence summary line, then a detailed',
    'technical analysis that references concrete `repo/` source paths.',
    'Do not create or edit `knowledge/index.md` (managed automatically). Do not modify source',
    'code. Do not commit. Emit no other output.',
].join(' ')

async function skillBody(): Promise<string> {
    try {
        const raw = await fs.readFile(path.join(config.appSkillsDir, 'knowledge-writer', 'SKILL.md'), 'utf8')
        return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
    } catch {
        return FALLBACK_BODY
    }
}

const AGENT_ARGS = '--print --output-format=text --permission-mode acceptEdits'

const INDEX_ID = 'index.md'

export interface KnowledgeResult {
    /** knowledge-relative ids the agent created/changed (excludes the app-owned index). */
    files: string[]
    stdout: string
    timedOut: boolean
}

/**
 * Rebuild the app-owned `knowledge/index.md` from the docs on disk: a reference
 * list linking every topic doc with its one-line summary. Removes the index when
 * no docs remain, so the knowledge base reads as empty again.
 */
export async function rebuildIndex(project: string): Promise<void> {
    const docs = (await listKnowledgeFiles(project)).filter((id) => id.toLowerCase() !== INDEX_ID)

    if (docs.length === 0) {
        await deleteKnowledgeFile(project, INDEX_ID)
        return
    }

    const entries = await Promise.all(
        docs.map(async (id) => {
            try {
                const content = await readKnowledgeFile(project, id)
                return { id, title: extractTitle(content, id), summary: extractSummary(content) }
            } catch {
                return null
            }
        }),
    )

    const lines = [
        `# ${project} — Knowledge Base`,
        '',
        'Reference index of analysis docs. Each entry links a topic doc generated from the repository source.',
        '',
        '## Docs',
        '',
    ]
    for (const e of entries) {
        if (!e) continue
        lines.push(`- [${e.title}](./${e.id})${e.summary ? ` — ${e.summary}` : ''}`)
    }
    lines.push('')
    await writeKnowledgeFile(project, INDEX_ID, lines.join('\n'))
}

/**
 * Assemble the knowledge-writer prompt for one user-named topic (cwd = project
 * root). The agent run itself is owned by the AgentSessionManager (streaming).
 */
export async function buildKnowledgeWriterPrompt(
    project: string,
    topic: string,
): Promise<{ cwd: string; prompt: string }> {
    const cwd = projectPath(project)
    await fs.mkdir(projectKnowledgeDir(project), { recursive: true })
    const body = await skillBody()

    const prompt = [
        body,
        '',
        'Analyze the following topic against the repository in the `repo/` subdirectory and write',
        'a single doc into the `knowledge/` directory at the project root. Pick the filename yourself.',
        '',
        '--- TOPIC ---',
        topic,
    ].join('\n')

    return { cwd, prompt }
}

/** Remove a single knowledge doc, then rebuild the index. The index itself is not removable. */
export async function removeKnowledge(project: string, id: string): Promise<void> {
    if (id.toLowerCase() === INDEX_ID) return
    await deleteKnowledgeFile(project, id)
    await rebuildIndex(project)
}

/**
 * Incremental update after a task completes: feed the task + its diff and ask the
 * agent to refresh only the affected topic docs (it never touches the index), then
 * rebuild the index so any summary/title edits propagate.
 */
export async function updateKnowledge(
    project: string,
    taskId: string,
    taskTitle: string,
    diff: string,
): Promise<KnowledgeResult> {
    const cwd = projectPath(project)
    await fs.mkdir(projectKnowledgeDir(project), { recursive: true })
    const body = await skillBody()
    const truncated = diff.length > 8000 ? diff.slice(0, 8000) + '\n…(truncated)…' : diff

    const prompt = [
        body,
        '',
        'A task was just completed in the `repo/` subdirectory. UPDATE the existing `knowledge/`',
        'docs to reflect the change. Only edit the docs whose topic is affected by it; do not create',
        'new docs and do not touch `knowledge/index.md`.',
        '',
        `--- TASK (${taskId}) ---`,
        taskTitle,
        '',
        '--- DIFF (changes made by the task) ---',
        '```diff',
        truncated,
        '```',
    ].join('\n')

    const res = await runAgentOnce({
        cwd,
        model: config.defaultModel,
        prompt,
        timeoutMs: config.knowledgeTimeoutMs,
        extraArgs: AGENT_ARGS,
    })

    await rebuildIndex(project)

    const files = (await listKnowledgeFiles(project)).filter((f) => f.toLowerCase() !== INDEX_ID)
    return { files, stdout: res.stdout, timedOut: res.timedOut }
}
