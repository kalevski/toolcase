// D4 — health / diagnostics. Assembles the environment checks whose failures
// otherwise surface as opaque mid-run errors (CLI missing/not logged in, volume
// full, wrong mounts). Every probe is individually fail-soft.

import 'server-only'
import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { config } from '@/server/config'
import { getRow } from '@/server/data/db'
import * as searchRepo from '@/server/data/repositories/search-repo'
import { listAccounts } from '@/server/services/accounts'
import { engine } from '@/server/services/execution-manager'
import type { HealthDetails } from '@/server/domain/types'

function versionOf(bin: string, args: string[] = ['--version']): Promise<string | null> {
    return new Promise((resolve) => {
        let out = ''
        let settled = false
        const done = (v: string | null) => {
            if (!settled) {
                settled = true
                resolve(v)
            }
        }
        try {
            const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'ignore'] })
            const timer = setTimeout(() => {
                child.kill('SIGKILL')
                done(null)
            }, 10_000)
            child.stdout.on('data', (d) => (out += d.toString()))
            child.on('close', () => {
                clearTimeout(timer)
                done(out.trim().split('\n')[0] || null)
            })
            child.on('error', () => {
                clearTimeout(timer)
                done(null)
            })
        } catch {
            done(null)
        }
    })
}

async function diskFree(dir: string): Promise<{ totalBytes: number; freeBytes: number } | null> {
    try {
        const s = await fs.statfs(dir)
        return { totalBytes: s.blocks * s.bsize, freeBytes: s.bavail * s.bsize }
    } catch {
        return null
    }
}

export async function healthDetails(): Promise<HealthDetails> {
    const [agentVersion, gitVersion, disk] = await Promise.all([
        versionOf(config.agentBin),
        versionOf('git'),
        diskFree(config.workspaceDir),
    ])

    let dbSize = 0
    try {
        dbSize = (await fs.stat(config.dbPath)).size
    } catch {
        /* not created yet */
    }
    let migrationVersion = 0
    try {
        migrationVersion =
            getRow<{ v: number | null }>('SELECT MAX(version) AS v FROM schema_migrations')?.v ?? 0
    } catch {
        /* DB unavailable */
    }

    return {
        ok: agentVersion !== null && gitVersion !== null,
        agentBin: config.agentBin,
        agentVersion,
        gitVersion,
        diskFree: disk,
        db: { path: config.dbPath, sizeBytes: dbSize, migrationVersion },
        engines: engine.states(),
        searchAvailable: searchRepo.searchAvailable(),
        // Cached, non-live: each account's auth method + last successful
        // use/verify (`lastUsedAt`). A live `verifyAccount` is deliberately NOT
        // run here — diagnostics must stay cheap and side-effect-free.
        accounts: listAccounts().map((a) => ({
            alias: a.alias,
            auth: a.auth,
            label: a.label,
            lastUsedAt: a.lastUsedAt,
        })),
        // Secrets redacted: only operational, non-sensitive values are surfaced.
        config: {
            workspaceDir: config.workspaceDir,
            defaultModel: config.defaultModel,
            modelCatalog: config.modelCatalog.join(','),
            commitAfterTask: config.commitAfterTask,
            knowledgeAutoUpdate: config.knowledgeAutoUpdate,
            usageGateEnabled: config.usageGateEnabled,
            usageGateThreshold: config.usageGateThreshold,
            warmSession: config.warmSession,
            logRetentionHours: config.logRetentionHours,
            slackConfigured: config.slackWebhookUrl !== '',
            notifyWebhookConfigured: config.notifyWebhookUrl !== '',
            gitPushConfigured: config.gitRemoteToken !== '' || process.env.GIT_SSH_CONFIGURED === '1',
            reviewModel: config.reviewModel,
        },
    }
}
