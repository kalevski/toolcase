// E1 per-project settings. Thin resolution layer: persisted per-project
// overrides (project_setting table) fall back to the env-derived global config.
// Consumers (engine defaults, run form initialization, notifications) read
// `effectiveSettings(project)` and never touch the table directly.

import 'server-only'
import { config } from '@/server/config'
import * as settingsRepo from '@/server/data/repositories/settings-repo'
import { dispatch } from '@/server/infrastructure/notify'
import type { CommitMessageMode, NotifyEvent, ProjectSettings } from '@/server/domain/types'
import { NOTIFY_EVENTS } from '@/server/domain/types'

/** Fully-resolved settings for one project (override → env fallback). */
export interface EffectiveSettings {
    defaultModel: string
    defaultAccount: string
    commitAfter: boolean
    commitMessageMode: CommitMessageMode
    commitModel: string
    warmSession: boolean
    knowledgeAutoUpdate: boolean
    usageGateThreshold: number
    pushAfter: boolean
    branchPerRun: boolean
    review: boolean
    openPr: boolean
    notifyEvents: string[]
    notifyWebhookUrl: string
}

/** The raw per-project overrides (absent keys mean "use env"). */
export function getProjectSettings(project: string): ProjectSettings {
    try {
        return settingsRepo.getSettings(project)
    } catch {
        return {}
    }
}

const VALID_EVENTS = new Set<string>(NOTIFY_EVENTS)

export class InvalidSettingsError extends Error {}

/**
 * SEC-1 — SSRF guard for the per-project notification webhook. `notify.dispatch`
 * does a server-side POST to this URL, so a `standard` user must not be able to
 * point it at internal infra (cloud metadata, localhost services, the LAN).
 * Require `https:` and reject loopback/link-local/private hosts. Empty/unset is
 * allowed (no webhook configured).
 */
function assertSafeWebhookUrl(raw: string): void {
    let url: URL
    try {
        url = new URL(raw)
    } catch {
        throw new InvalidSettingsError('notifyWebhookUrl must be a valid URL')
    }
    if (url.protocol !== 'https:') {
        throw new InvalidSettingsError('notifyWebhookUrl must use https')
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '') // strip IPv6 brackets
    if (host === 'localhost' || host.endsWith('.localhost')) {
        throw new InvalidSettingsError('notifyWebhookUrl host is not allowed')
    }
    // IPv6 loopback / unique-local (fc00::/7 → first byte 0xfc or 0xfd).
    if (host === '::1' || /^f[cd][0-9a-f]{2}:/.test(host)) {
        throw new InvalidSettingsError('notifyWebhookUrl host is not allowed')
    }
    // IPv4 literal → reject loopback (127/8), private (10/8, 172.16/12,
    // 192.168/16) and link-local (169.254/16) ranges.
    const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (v4) {
        const [a, b] = [Number(v4[1]), Number(v4[2])]
        const isPrivate =
            a === 127 ||
            a === 10 ||
            (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) ||
            (a === 169 && b === 254)
        if (isPrivate) {
            throw new InvalidSettingsError('notifyWebhookUrl host is not allowed')
        }
    }
}

/** Validate + persist overrides. Unknown notify events / models are rejected. */
export function saveProjectSettings(project: string, settings: ProjectSettings): ProjectSettings {
    if (settings.defaultModel !== undefined && settings.defaultModel !== null && settings.defaultModel !== '') {
        if (!config.modelCatalog.includes(settings.defaultModel)) {
            throw new InvalidSettingsError(`model not in catalog: ${settings.defaultModel}`)
        }
    }
    if (settings.defaultAccount !== undefined && settings.defaultAccount !== null && settings.defaultAccount !== '') {
        // Guard the registry import: settings must still save when the accounts
        // foundation isn't present (module/table absent). When it is, the alias
        // must name a known account.
        let accounts: typeof import('@/server/services/accounts') | undefined
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentional sync conditional load; module may be absent
            accounts = require('@/server/services/accounts')
        } catch {
            accounts = undefined
        }
        if (accounts && !accounts.getAccount(settings.defaultAccount)) {
            throw new InvalidSettingsError(`unknown account alias: ${settings.defaultAccount}`)
        }
    }
    if (settings.commitMessageMode !== undefined && settings.commitMessageMode !== null) {
        if (settings.commitMessageMode !== 'taskname' && settings.commitMessageMode !== 'ai') {
            throw new InvalidSettingsError('commitMessageMode must be taskname|ai')
        }
    }
    if (settings.usageGateThreshold !== undefined && settings.usageGateThreshold !== null) {
        const t = Number(settings.usageGateThreshold)
        if (!Number.isFinite(t) || t < 1 || t > 100) {
            throw new InvalidSettingsError('usageGateThreshold must be 1–100')
        }
        settings.usageGateThreshold = t
    }
    if (settings.notifyEvents !== undefined && settings.notifyEvents !== null) {
        if (!Array.isArray(settings.notifyEvents) || settings.notifyEvents.some((e) => !VALID_EVENTS.has(e))) {
            throw new InvalidSettingsError(`notifyEvents must be a subset of: ${NOTIFY_EVENTS.join(', ')}`)
        }
    }
    if (settings.notifyWebhookUrl !== undefined && settings.notifyWebhookUrl !== null && settings.notifyWebhookUrl !== '') {
        assertSafeWebhookUrl(settings.notifyWebhookUrl)
    }
    settingsRepo.saveSettings(project, settings)
    return getProjectSettings(project)
}

export function effectiveSettings(project: string): EffectiveSettings {
    const s = getProjectSettings(project)
    return {
        defaultModel: s.defaultModel ?? config.defaultModel,
        defaultAccount: s.defaultAccount ?? config.defaultAccount,
        commitAfter: s.commitAfter ?? config.commitAfterTask,
        commitMessageMode: s.commitMessageMode ?? config.commitMessageMode,
        commitModel: s.commitModel ?? config.commitModel,
        warmSession: s.warmSession ?? config.warmSession,
        knowledgeAutoUpdate: s.knowledgeAutoUpdate ?? config.knowledgeAutoUpdate,
        usageGateThreshold: s.usageGateThreshold ?? config.usageGateThreshold,
        pushAfter: s.pushAfter ?? false,
        branchPerRun: s.branchPerRun ?? false,
        review: s.review ?? false,
        openPr: s.openPr ?? false,
        notifyEvents: s.notifyEvents ?? config.notifyEvents,
        notifyWebhookUrl: s.notifyWebhookUrl ?? config.notifyWebhookUrl,
    }
}

/** D2 — resolved notification targets for `notify.dispatch`. */
export function notifyTargets(project: string): { events: string[]; webhookUrl: string } {
    const eff = effectiveSettings(project)
    return { events: eff.notifyEvents, webhookUrl: eff.notifyWebhookUrl }
}

/** Convenience used by engine call sites. */
export function dispatchProjectEvent(
    project: string,
    event: NotifyEvent,
    text: string,
    data?: Record<string, unknown>,
): void {
    try {
        dispatch(project, event, { text, data }, notifyTargets(project))
    } catch {
        /* notifications are best-effort */
    }
}
