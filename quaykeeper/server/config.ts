// Centralized, validated configuration for Quaykeeper. Reads `process.env` once and
// fails fast at first import if a required variable is missing. Ported from
// TaskForge's `server/config.ts`, trimmed to the auth/OAuth surface this project
// needs today (the rest — nginxpilot seam, sponsors — arrive with later tasks).
//
// Server-only. Never import from a client component.
// See notes/static-hosting-app-design.md §5, §7, §16.

import 'server-only'

function required(name: string): string {
    const value = process.env[name]
    if (!value || value.trim() === '') {
        // During `next build` the module graph is imported for tracing; env is
        // not yet provided. Defer the failure to runtime (fail-fast at boot /
        // first request) rather than breaking the build.
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''
        throw new Error(
            `[quaykeeper] Missing required environment variable: ${name}. ` +
                `See notes/static-hosting-app-design.md §7 for the auth env vars.`,
        )
    }
    return value
}

/** Like `required`, but also rejects a too-short secret (weak HMAC key). */
function requiredSecret(name: string, minLen: number): string {
    const value = required(name)
    // `required` returns '' during `next build` tracing — skip the length gate
    // there and let the runtime boot enforce it on the real value.
    if (value && value.length < minLen) {
        throw new Error(
            `[quaykeeper] ${name} must be at least ${minLen} characters (got ${value.length}). ` +
                `Use a long random string, e.g. \`openssl rand -hex 32\`.`,
        )
    }
    return value
}

function optional(name: string, fallback: string): string {
    const value = process.env[name]
    return value && value.trim() !== '' ? value : fallback
}

function num(name: string, fallback: number): number {
    const raw = process.env[name]
    if (!raw || raw.trim() === '') return fallback
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : fallback
}

function csv(name: string): string[] {
    const raw = process.env[name]
    if (!raw) return []
    return raw.split(',').flatMap((s) => {
        const trimmed = s.trim()
        return trimmed ? [trimmed] : []
    })
}

export const config = {
    // ── GitHub OAuth (§7) ──
    githubClientId: required('QUAYKEEPER_GITHUB_CLIENT_ID'),
    githubClientSecret: required('QUAYKEEPER_GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('QUAYKEEPER_OAUTH_REDIRECT_URI'),

    // Public-facing origin (scheme + host[:port]) the browser actually talks to.
    // Behind a reverse proxy, `req.url` reflects the internal listen address
    // (e.g. http://0.0.0.0:4100), so app-relative redirects built from it leak
    // that internal host to the browser. The OAuth redirect URI is the
    // authoritative public URL (GitHub redirects the browser there), so derive
    // the origin from it. Override with QUAYKEEPER_PUBLIC_ORIGIN if they differ.
    get publicOrigin(): string {
        const explicit = process.env.QUAYKEEPER_PUBLIC_ORIGIN
        if (explicit && explicit.trim() !== '') return explicit.trim().replace(/\/+$/, '')
        try {
            return new URL(this.oauthRedirectUri).origin
        } catch {
            return ''
        }
    },

    // ── session cookie (§7) ──
    // 32-char minimum: this secret signs every session cookie AND (absent a dedicated
    // QUAYKEEPER_REALM_KEY) is the HKDF source for the at-rest AES-256-GCM key, so a
    // short human-chosen passphrase would collapse both. Use `openssl rand -hex 32`.
    authSecret: requiredSecret('QUAYKEEPER_AUTH_SECRET', 32),
    sessionTtl: num('QUAYKEEPER_SESSION_TTL', 86400),

    // ── realm secret encryption (multiple_realms.md §B.1, §10.5) ──
    // A realm's nginxpilot admin token is encrypted at rest with AES-256-GCM
    // (`server/infrastructure/cipher.ts`). The key comes from a dedicated
    // `QUAYKEEPER_REALM_KEY` (recommended — any string; it's hashed to 32 bytes) when set,
    // otherwise it is HKDF-derived from `QUAYKEEPER_AUTH_SECRET` so an existing deployment
    // needs no new env. `QUAYKEEPER_REALM_KEY_PREV` (optional) keeps a rotated-out key in the
    // ring so ciphertext sealed with the old key still decrypts after a rotation.
    realmKey: optional('QUAYKEEPER_REALM_KEY', ''),
    realmKeyPrev: optional('QUAYKEEPER_REALM_KEY_PREV', ''),
    // Optional SSRF allowlist for realm admin URLs (host globs, comma-separated). Empty
    // means owner-only registration is the sole control (the owner can already point the
    // single env instance anywhere today). See `services/realms.ts` createRealm (§9).
    realmUrlAllowlist: csv('QUAYKEEPER_REALM_URL_ALLOWLIST'),

    // ── optional allowlist / org gate (§7 — off by default for a public free service) ──
    allowedLogins: csv('QUAYKEEPER_ALLOWED_LOGINS'),
    allowedOrg: optional('QUAYKEEPER_ALLOWED_ORG', ''),


    // ── nginxpilot integration seam (§4, §16) ──
    // Base URL of nginxpilot's admin REST API. Quaykeeper drives the ENTIRE integration
    // through this API — site config (`POST`/`DELETE /sites`) and operations
    // (`/status`, `/sync`, `/vhost`, `/reload`) — and never touches nginxpilot's
    // filesystem, so the two only need a shared network. Loopback by default
    // (`admin.listen` defaults to 127.0.0.1:9090); across containers point this at the
    // daemon's service name (e.g. http://nginxpilot:9090) and set `admin.listen:
    // 0.0.0.0:9090` + a bearer token, keeping the port off the public network (§16).
    nginxpilotAdminUrl: optional('QUAYKEEPER_NGINXPILOT_ADMIN_URL', 'http://127.0.0.1:9090').replace(/\/+$/, ''),
    // Bearer token matching nginxpilot's `admin.token_env`. Optional: empty means the
    // admin endpoint runs unauthenticated (loopback default) and Quaykeeper sends no header.
    nginxpilotAdminToken: optional('QUAYKEEPER_NGINXPILOT_ADMIN_TOKEN', ''),

    // ── quota enforcement (§11) ──
    // Grace window (seconds) an over-quota site keeps serving after it is flagged
    // before Quaykeeper suspends it (removes the fragment so it stops serving). `0`
    // suspends on the next enforcement pass; the default 24h gives the user time to
    // trim the build or upgrade their plan. Owner-tunable.
    quotaGraceSec: num('QUAYKEEPER_QUOTA_GRACE_SEC', 86400),

    // ── custom domains (§10, §16) ──
    // Public ingress IPv4 a user's custom domain must point at. Quaykeeper hands this out
    // in the A-record instructions and re-resolves the domain server-side to confirm
    // it points here BEFORE issuing a cert (§16: prevents domain takeover). Empty
    // means custom-domain verification is unavailable — the verify step then fails
    // closed (it can't confirm a match it has no IP to compare against).
    // This is the *fallback* default: the owner can override it at runtime from the
    // admin Settings surface (`app_setting` table); `services/settings.ts` resolves
    // the effective value (stored override wins, else this env default).
    ingressIpv4: optional('QUAYKEEPER_INGRESS_IPV4', ''),
    // Public ingress IPv6 handed out in the AAAA-record instructions (optional —
    // empty omits the AAAA line). Same stored-override-then-env path as ingressIpv4.
    ingressIpv6: optional('QUAYKEEPER_INGRESS_IPV6', ''),

    port: num('PORT', 4100),

    // ── scheduled jobs (the Scheduled tasks page) ──
    // Interpreter for a `shell`-kind job's script. The script is written to a temp
    // file and run as `<shell> <file>`. Defaults to bash (present in the node:24-slim
    // image and on Ubuntu hosts); override to `/bin/sh` for a minimal container. A
    // missing interpreter surfaces as a failed run (spawn ENOENT), never a crash.
    jobShell: optional('QUAYKEEPER_JOB_SHELL', '/bin/bash'),

    // ── database export / import (Databases tab → Export / Import database) ──
    // The native dump tools, resolved on PATH by default — the Dockerfile installs
    // postgresql-client (PGDG) and mysql-community-client into the runner image.
    // Point these at absolute paths when developing on a host where they live off
    // PATH, or where `mysqldump` is MariaDB's: quaykeeper passes MySQL-8 client flags
    // (`--column-statistics`, `--set-gtid-purged`) that MariaDB's dumper rejects.
    // A missing binary surfaces as a clear `dump_tool_missing` error, not a crash.
    pgDumpBin: optional('QUAYKEEPER_PG_DUMP_BIN', 'pg_dump'),
    psqlBin: optional('QUAYKEEPER_PSQL_BIN', 'psql'),
    mysqlDumpBin: optional('QUAYKEEPER_MYSQLDUMP_BIN', 'mysqldump'),
    mysqlBin: optional('QUAYKEEPER_MYSQL_BIN', 'mysql'),
    // Wall-clock cap for one dump/restore child (ms). A large database legitimately
    // takes minutes — this only stops a hung tool from pinning a pipe forever.
    dbDumpTimeoutMs: num('QUAYKEEPER_DB_DUMP_TIMEOUT_MS', 1_800_000),
    // Hard cap on an uploaded .sql import (bytes). The upload streams straight into
    // the client's stdin, so this bounds the restore, not quaykeeper's memory.
    dbImportMaxBytes: num('QUAYKEEPER_DB_IMPORT_MAX_BYTES', 2_147_483_648),

    // ── Config subsystem: the companion agent listener (move_wharf_to_perch.md §9) ──
    // Port of the machine-facing agent server (`server/agent-server.ts`): the
    // instance-fetch API (`/v1/config|env|flags`) and quaykeeper-client binary
    // distribution (`/v1/client/{os}/{arch}`, `/v1/install.sh`). Separate from the
    // Next.js UI/API port so operators can expose the two surfaces independently.
    agentPort: num('QUAYKEEPER_AGENT_PORT', 4101),

    // Where the baked-in cross-compiled quaykeeper-client binaries live (the
    // Dockerfile's `client` build stage populates this). Served unauthenticated by
    // the agent server's `/v1/client/{os}/{arch}`.
    get clientDir() {
        return optional('QUAYKEEPER_CLIENT_DIR', `${process.cwd()}/client-bin`)
    },
}

export type Config = typeof config
