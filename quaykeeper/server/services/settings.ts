// Global instance-settings service (§13) — the policy layer behind the settings
// routes. Two surfaces:
//
//   • PUBLIC read  (`GET /api/settings`)        — the effective branding + ingress,
//     readable by anyone (the login screen needs the app name + theme before auth,
//     and the A-record ingress IP is inherently public DNS-target info).
//   • OWNER write  (`GET`/`PUT /api/admin/settings`) — read + replace, owner-gated
//     and audited.
//
// The effective record is `DEFAULT_SETTINGS` ← the env ingress fallback ← the stored
// `app_setting` overrides, so a fresh instance resolves to a complete record and the
// ingress IP an operator set via `QUAYKEEPER_INGRESS_IPV4` keeps working until the owner
// overrides it from the UI. Pure validation + (de)coding live in `domain/settings.ts`;
// this is the `server-only` wiring (repo + config fallback + audit).
//
// See notes/static-hosting-app-design.md §10, §13, §16.

import 'server-only'
import * as settingRepo from '@/server/data/repositories/setting-repo'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import { config } from '@/server/config'
import { slog } from '@/server/infrastructure/server-log'
import {
    DEFAULT_SETTINGS,
    SETTING_KEYS,
    decodeStored,
    parseSettingsUpdate,
    type SiteSettings,
} from '@/server/domain/settings'

/**
 * A settings refusal: a malformed body (`400`). Carries the machine-readable `code`
 * and HTTP `status` a route returns (mirrors `AdminError`). Settings only ever
 * reject with 400, so the status is fixed.
 */
export class SettingsError extends Error {
    constructor(
        message: string,
        public code: string,
        public status: 400 = 400,
    ) {
        super(message)
        this.name = 'SettingsError'
    }
}

/** The acting owner, attributed on the audit entry (mirrors `AdminActor`). */
export interface SettingsActor {
    githubId: number
    login: string
}

/**
 * The effective instance settings: built-in defaults, then the env ingress
 * fallback, then any stored owner overrides on top. Always a complete record.
 */
export function getSettings(): SiteSettings {
    const stored = decodeStored(settingRepo.getAll())
    return {
        ...DEFAULT_SETTINGS,
        // Env defaults for the ingress IPs (an operator can set these before the
        // owner ever opens the UI); a stored override below wins over them.
        ingressIpv4: config.ingressIpv4 || DEFAULT_SETTINGS.ingressIpv4,
        ingressIpv6: config.ingressIpv6 || DEFAULT_SETTINGS.ingressIpv6,
        ...stored,
    }
}

/**
 * The effective ingress IPv4 a custom domain must point at — the value the
 * domains service verifies against and the UI shows in the A-record. Empty when
 * neither a stored override nor the env default is set (verification unavailable).
 */
export function effectiveIngressIpv4(): string {
    return getSettings().ingressIpv4
}

/**
 * The public projection (`GET /api/settings`). Currently identical to the full
 * record — every settings field is non-sensitive (branding + public DNS targets) —
 * but kept as its own function so a future secret setting isn't leaked by default.
 */
export function getPublicSettings(): SiteSettings {
    return getSettings()
}

/**
 * Validate + persist an owner-supplied settings patch (`PUT /api/admin/settings`):
 * only the present fields are written; an empty ingress IP clears that override back
 * to the env default. Audits the change against the acting owner and returns the new
 * effective record. Throws {@link SettingsError} (400) on a malformed body.
 */
export function updateSettings(actor: SettingsActor, input: unknown): SiteSettings {
    const checked = parseSettingsUpdate(input)
    if (!checked.ok) throw new SettingsError(checked.message, `settings_${checked.reason}`)

    const entries: Record<string, string> = {}
    for (const [field, value] of Object.entries(checked.patch)) {
        entries[SETTING_KEYS[field as keyof SiteSettings]] = value as string
    }

    if (Object.keys(entries).length > 0) {
        settingRepo.setMany(entries)
        const detail = Object.entries(checked.patch)
            .map(([k, v]) => `${k}=${v === '' ? '(cleared)' : v}`)
            .join(',')
        auditRepo.append({
            githubId: actor.githubId,
            login: actor.login,
            action: 'admin.settings.update',
            site: null,
            detail,
        })
        slog('info', 'admin', 'settings updated', { detail, by: actor.login })
    }

    return getSettings()
}

/** A route-ready error: the HTTP status + a machine-readable code. */
export interface HttpError {
    status: number
    code: string
}

/** Map any error a settings operation can throw to its HTTP status + code. */
export function httpErrorFor(err: unknown): HttpError {
    if (err instanceof SettingsError) return { status: err.status, code: err.code }
    return { status: 500, code: 'internal_error' }
}
