// AI commit-message generation via the bundled `commit-message` skill.
// Shared by the execution engine (commit-after-task) and the manual commit
// endpoint on the Git page.

import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { config } from '@/server/config'
import { runAgentOnce } from '@/server/infrastructure/agent'
import { projectPath } from '@/server/infrastructure/fs-workspace'

const DIFF_CAP = 12000

/**
 * Generate a single commit message for `diff` (already staged). Returns null on
 * timeout/failure so callers can fall back to a deterministic message.
 */
export async function aiCommitMessage(project: string, diff: string, model: string): Promise<string | null> {
    try {
        let skillBody = ''
        try {
            const raw = await fs.readFile(path.join(config.appSkillsDir, 'commit-message', 'SKILL.md'), 'utf8')
            skillBody = raw.replace(/^---\n[\s\S]*?\n---\n/, '').trim()
        } catch {
            skillBody =
                'Write a single Conventional Commits message (subject <= 72 chars, optional short body) describing the staged diff. Output ONLY the commit message.'
        }
        const truncated = diff.length > DIFF_CAP ? diff.slice(0, DIFF_CAP) + '\n…(truncated)…' : diff
        const prompt = `${skillBody}\n\nStaged diff:\n\n\`\`\`diff\n${truncated}\n\`\`\`\n\nOutput ONLY the commit message text.`
        const res = await runAgentOnce({
            cwd: projectPath(project),
            model,
            prompt,
            timeoutMs: 60000,
            extraArgs: '--print --output-format=text --permission-mode plan',
        })
        const msg = res.stdout.trim()
        return msg && !res.timedOut ? msg : null
    } catch {
        return null
    }
}
