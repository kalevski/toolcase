// Optional Slack batch notification on run completion (§6.9, notify_slack_batch).

import 'server-only'
import { config } from './config'
import { readTaskFile, parseTask } from './fs-workspace'

async function summarize(repo: string, rel: string): Promise<string> {
    try {
        const content = await readTaskFile(repo, rel)
        const { title } = parseTask(content, rel)
        const problem = content.match(/##\s*Problem\s*\n+\s*(.+)/i)?.[1]?.trim()
        return problem ? `• *${title}* — ${problem}` : `• *${title}*`
    } catch {
        return `• ${rel}`
    }
}

export async function notifyBatch(repo: string, completed: string[], errored: string[]): Promise<void> {
    if (!config.slackWebhookUrl) return

    const lines: string[] = [`*TaskForge* run finished for \`${repo}\``]
    if (completed.length) {
        lines.push(`\n*Completed (${completed.length}):*`)
        lines.push(...(await Promise.all(completed.map((rel) => summarize(repo, rel)))))
    }
    if (errored.length) {
        lines.push(`\n*Errored (${errored.length}):*`)
        lines.push(...(await Promise.all(errored.map((rel) => summarize(repo, rel)))))
    }

    await fetch(config.slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: lines.join('\n') }),
    })
}
