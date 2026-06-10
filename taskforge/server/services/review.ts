// B8 reviewer agent — a cheap post-task verification pass. Gets the task body +
// the task's diff and answers "does the diff plausibly satisfy the task?".
// Strictly advisory: failures/timeouts return null and never block the queue.

import 'server-only'
import { config } from '@/server/config'
import { runAgentOnce } from '@/server/infrastructure/agent'
import { projectPath } from '@/server/infrastructure/fs-workspace'

const DIFF_CAP = 12000

export interface ReviewResult {
    verdict: 'pass' | 'fail'
    note: string
}

const PROMPT_HEAD = [
    'You are an adversarial code reviewer. You are given a task description and the diff',
    'that an autonomous engineer produced for it. Judge ONLY whether the diff plausibly',
    'satisfies the task — not style. Look for: missing requirements, wrong files touched,',
    'no-op or trivially incomplete changes, and changes contradicting the task.',
    '',
    'Answer on the FIRST line with exactly PASS or FAIL, then ONE short paragraph (max 60',
    'words) explaining why. No other output.',
].join('\n')

/**
 * Run the reviewer over one completed task. Returns null when the reviewer
 * could not produce a verdict (timeout, spawn failure, unparseable output).
 */
export async function reviewTask(
    project: string,
    taskId: string,
    taskBody: string,
    diff: string,
): Promise<ReviewResult | null> {
    try {
        if (!diff.trim()) {
            return { verdict: 'fail', note: 'No diff was produced for this task.' }
        }
        const truncated = diff.length > DIFF_CAP ? diff.slice(0, DIFF_CAP) + '\n…(truncated)…' : diff
        const prompt = [
            PROMPT_HEAD,
            '',
            `--- TASK (${taskId}) ---`,
            taskBody.slice(0, 6000),
            '',
            '--- DIFF ---',
            '```diff',
            truncated,
            '```',
        ].join('\n')

        const res = await runAgentOnce({
            cwd: projectPath(project),
            model: config.reviewModel,
            prompt,
            timeoutMs: config.reviewTimeoutMs,
            // Read-only judgment — plan mode, plain text.
            extraArgs: '--print --output-format=text --permission-mode plan',
        })
        if (res.timedOut || res.code !== 0) return null

        const out = res.stdout.trim()
        const m = out.match(/^\s*(PASS|FAIL)\b/i)
        if (!m) return null
        const note = out.replace(/^\s*(PASS|FAIL)\b[:\s—-]*/i, '').trim().slice(0, 500)
        return { verdict: m[1].toUpperCase() === 'PASS' ? 'pass' : 'fail', note }
    } catch {
        return null
    }
}
