// Task creator (§7): turn a free-text prompt into numbered task files via the
// bundled, read-only `task-creator` skill shipped in the image. The agent run
// itself is owned by the AgentSessionManager (streaming); this module only
// assembles the prompt + working directory.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { nextTaskNumber, projectTasksDir } from '@/server/infrastructure/fs-workspace'

async function skillBody(): Promise<string> {
    try {
        const raw = await fs.readFile(path.join(config.appSkillsDir, 'task-creator', 'SKILL.md'), 'utf8')
        return raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
    } catch {
        return [
            'Decompose the request into discrete, independently-solvable tasks.',
            'Write each task as its own Markdown file in the current directory, named `<NNN>-<slug>.md`',
            'where <NNN> is a zero-padded number continuing the existing sequence.',
            'Each file must start with an H1 title and a `**Status:** open` line.',
            'Optionally add `**Severity:**` and `**Project:**`. One task per file. Emit nothing else.',
        ].join(' ')
    }
}

export interface AgentPromptSpec {
    cwd: string
    prompt: string
}

/** Assemble the task-creator prompt (cwd = the project's `tasks/` directory). */
export async function buildTaskCreatorPrompt(project: string, userPrompt: string): Promise<AgentPromptSpec> {
    const cwd = projectTasksDir(project)
    await fs.mkdir(cwd, { recursive: true })

    // nextTaskNumber also counts archived files (A5) so numbers stay monotonic.
    const next = await nextTaskNumber(project)
    const highest = next - 1
    const body = await skillBody()

    const prompt = [
        body,
        '',
        `The current highest task number is ${highest.toString().padStart(3, '0')}; begin new files at ${next
            .toString()
            .padStart(3, '0')}.`,
        'Create the new task files in the CURRENT directory (do not nest them).',
        '',
        '--- REQUEST ---',
        userPrompt,
    ].join('\n')

    return { cwd, prompt }
}
