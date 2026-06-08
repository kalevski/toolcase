// Task creator (§7): turn a free-text prompt into numbered task files via the
// bundled, read-only `task-creator` skill shipped in the image.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from './config'
import { runAgentOnce } from './agent'
import { listTaskFiles, projectTasksDir } from './fs-workspace'

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

/** Highest existing numeric prefix among current task files. */
async function highestPrefix(project: string): Promise<number> {
    const files = await listTaskFiles(project)
    let max = 0
    for (const f of files) {
        const base = f.split('/').pop() || f
        const m = base.match(/^(\d+)/)
        if (m) max = Math.max(max, Number(m[1]))
    }
    return max
}

export interface GenerateResult {
    created: string[]
    stdout: string
    timedOut: boolean
}

export async function generateTasks(
    project: string,
    userPrompt: string,
    model: string = config.defaultModel,
): Promise<GenerateResult> {
    const cwd = projectTasksDir(project)
    await fs.mkdir(cwd, { recursive: true })

    const before = new Set(await listTaskFiles(project))
    const next = (await highestPrefix(project)) + 1
    const body = await skillBody()

    const prompt = [
        body,
        '',
        `The current highest task number is ${(await highestPrefix(project))
            .toString()
            .padStart(3, '0')}; begin new files at ${next.toString().padStart(3, '0')}.`,
        'Create the new task files in the CURRENT directory (do not nest them).',
        '',
        '--- REQUEST ---',
        userPrompt,
    ].join('\n')

    const res = await runAgentOnce({
        cwd,
        model,
        prompt,
        timeoutMs: config.generateTimeoutMs,
        extraArgs: '--print --output-format=text --permission-mode acceptEdits',
    })

    const after = await listTaskFiles(project)
    const created = after.filter((f) => !before.has(f))
    return { created, stdout: res.stdout, timedOut: res.timedOut }
}
