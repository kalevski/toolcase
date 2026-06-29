// Perch e2e assertions — drives a LIVE Perch server (talking to a LIVE nginxpilot
// daemon) over HTTP, exercising the new global-settings + custom-domain-ingress
// features. Run by `run-e2e.sh`, which boots both daemons first. Requires Node ≥22.5
// (uses the built-in `node:sqlite` to seed the owner + a custom-domain site, since
// the real sign-in path is GitHub OAuth and can't run unattended).
//
// What it proves:
//   • branding settings round-trip (defaults → owner PUT → public GET reflects it),
//   • theme persists and is one of the bundled web-components skins,
//   • the server IP set in Settings drives custom-domain A-record verification
//     (unset → 503 unavailable; set → used as the `expected` A-record target),
//   • owner-gating (no cookie → 401; bad body → 400),
//   • Perch ↔ nginxpilot integration (GET /api/routing/proxies round-trips the daemon).

import { DatabaseSync } from 'node:sqlite'
import crypto from 'node:crypto'

const BASE = process.env.PERCH_BASE ?? 'http://127.0.0.1:4100'
const SECRET = process.env.PERCH_AUTH_SECRET
const DB = process.env.PERCH_DB_PATH

if (!SECRET || !DB) {
    console.error('PERCH_AUTH_SECRET and PERCH_DB_PATH must be set')
    process.exit(2)
}

// ── seed an owner + a custom-domain site directly into the SQLite store ─────────
{
    const db = new DatabaseSync(DB)
    const now = new Date().toISOString()
    db.prepare(
        'INSERT OR REPLACE INTO app_user (github_id, login, name, avatar_url, role, added_at) VALUES (?,?,?,?,?,?)',
    ).run(1, 'e2e-owner', 'E2E Owner', null, 'owner', now)
    db.prepare(
        `INSERT OR REPLACE INTO site
         (id, owner_id, repo_owner, repo_name, branch, subdir, hostname, host_kind, status, bytes, last_ref, last_error, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run('e2esite', 1, 'acme', 'site', 'main', null, 'test.example.org', 'custom', 'draft', null, null, null, now, now)
    db.close()
    console.log('seeded owner (github_id=1) + custom-domain site e2esite')
}

// ── mint a session cookie with the same HMAC scheme as services/auth.ts ─────────
const b64url = (s) => Buffer.from(s).toString('base64url')
function sign(obj) {
    const p = b64url(JSON.stringify(obj))
    const sig = crypto.createHmac('sha256', SECRET).update(p).digest('base64url')
    return `${p}.${sig}`
}
const nowSec = Math.floor(Date.now() / 1000)
const token = sign({ sub: 1, login: 'e2e-owner', role: 'owner', iat: nowSec, exp: nowSec + 86400 })
const COOKIE = `perch_session=${token}`

// ── tiny assert harness ────────────────────────────────────────────────────────
let pass = 0
let fail = 0
function ok(name, cond, extra) {
    if (cond) {
        pass++
        console.log('  PASS', name)
    } else {
        fail++
        console.error('  FAIL', name, extra !== undefined ? JSON.stringify(extra) : '')
    }
}
const authGet = (path) => fetch(`${BASE}${path}`, { headers: { Cookie: COOKIE } })
const jsonPut = (path, body, withCookie = true) =>
    fetch(`${BASE}${path}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...(withCookie ? { Cookie: COOKIE } : {}) },
        body: JSON.stringify(body),
    })
const jsonPost = (path, body) =>
    fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Cookie: COOKIE },
        body: JSON.stringify(body),
    })

async function main() {
    // 1. identity — the seeded owner is recognised (role re-read from the DB).
    {
        const res = await authGet('/api/me')
        const me = await res.json().catch(() => ({}))
        ok('GET /api/me → 200 owner', res.status === 200 && me.role === 'owner' && me.login === 'e2e-owner', {
            status: res.status,
            me,
        })
    }

    // 2. public settings default to the built-in branding (no overrides yet).
    {
        const res = await fetch(`${BASE}/api/settings`)
        const s = await res.json().catch(() => ({}))
        ok(
            'GET /api/settings (public) → defaults',
            res.status === 200 && s.appName === 'Perch' && s.theme === 'default' && s.ingressIpv4 === '',
            s,
        )
    }

    // 3. with NO server IP, custom-domain verification is unavailable (fail-closed).
    {
        const res = await jsonPost('/api/sites/e2esite/verify-domain', {})
        const body = await res.json().catch(() => ({}))
        ok('verify-domain (no server IP) → 503 ingress_unconfigured', res.status === 503 && body.error === 'ingress_unconfigured', {
            status: res.status,
            body,
        })
    }

    // 4. owner updates branding + the server IP.
    {
        const res = await jsonPut('/api/admin/settings', {
            appName: 'NimbusHost',
            tagline: 'Ship a branch as a site',
            theme: 'aurora',
            brandColor: '#7C3AED',
            ingressIpv4: '203.0.113.10',
            ingressIpv6: '2001:db8::10',
        })
        const s = await res.json().catch(() => ({}))
        ok(
            'PUT /api/admin/settings → 200 updated',
            res.status === 200 &&
                s.appName === 'NimbusHost' &&
                s.theme === 'aurora' &&
                s.brandColor === '#7c3aed' &&
                s.ingressIpv4 === '203.0.113.10' &&
                s.ingressIpv6 === '2001:db8::10',
            s,
        )
    }

    // 5. the public projection now reflects the new branding (login screen / wizard).
    {
        const res = await fetch(`${BASE}/api/settings`)
        const s = await res.json().catch(() => ({}))
        ok(
            'GET /api/settings reflects the update',
            s.appName === 'NimbusHost' && s.theme === 'aurora' && s.ingressIpv4 === '203.0.113.10' && s.brandColor === '#7c3aed',
            s,
        )
    }

    // 6. the owner read-back matches (persisted across requests / connections).
    {
        const res = await authGet('/api/admin/settings')
        const s = await res.json().catch(() => ({}))
        ok('GET /api/admin/settings persisted', res.status === 200 && s.theme === 'aurora' && s.appName === 'NimbusHost', s)
    }

    // 7. theme is one of the bundled web-components skins.
    {
        const res = await fetch(`${BASE}/api/settings`)
        const s = await res.json().catch(() => ({}))
        const themes = ['default', 'dungeon', 'aurora', 'sunshine', 'neon']
        ok('theme is a bundled skin', themes.includes(s.theme), s.theme)
    }

    // 8. the server IP set in Settings is now the A-record target verification uses.
    {
        const res = await jsonPost('/api/sites/e2esite/verify-domain', {})
        const body = await res.json().catch(() => ({}))
        ok(
            'verify-domain (server IP set) → 200, expected = stored IP',
            res.status === 200 && body.expected === '203.0.113.10' && body.verified === false && body.provisioned === false,
            { status: res.status, body },
        )
    }

    // 9. owner-gating: no cookie → 401.
    {
        const res = await jsonPut('/api/admin/settings', { appName: 'Hijack' }, false)
        ok('PUT /api/admin/settings (no cookie) → 401', res.status === 401, res.status)
    }

    // 10. validation: a bogus theme → 400.
    {
        const res = await jsonPut('/api/admin/settings', { theme: 'midnight' })
        const body = await res.json().catch(() => ({}))
        ok('PUT bad theme → 400 settings_theme', res.status === 400 && body.error === 'settings_theme', {
            status: res.status,
            body,
        })
    }

    // 11. clearing the server IP makes verification unavailable again (round-trip).
    {
        const put = await jsonPut('/api/admin/settings', { ingressIpv4: '' })
        const s = await put.json().catch(() => ({}))
        const res = await jsonPost('/api/sites/e2esite/verify-domain', {})
        const body = await res.json().catch(() => ({}))
        ok(
            'cleared server IP → verify-domain 503 again',
            put.status === 200 && s.ingressIpv4 === '' && res.status === 503 && body.error === 'ingress_unconfigured',
            { put: s, status: res.status, body },
        )
        // restore for any later manual inspection
        await jsonPut('/api/admin/settings', { ingressIpv4: '203.0.113.10' })
    }

    // 12. base-domain pool round-trips (existing admin surface still works).
    {
        const add = await jsonPost('/api/admin/base-domains', { domain: 'nimbus.dev', tier: 'free' })
        const list = await authGet('/api/admin/base-domains').then((r) => r.json())
        ok(
            'base domain add + list',
            (add.status === 201 || add.status === 200) && Array.isArray(list) && list.some((b) => b.domain === 'nimbus.dev'),
            { add: add.status, list },
        )
    }

    // 13. Perch ↔ nginxpilot: the routing proxies read round-trips the live daemon.
    {
        const res = await authGet('/api/routing/proxies')
        const body = await res.json().catch(() => null)
        ok('GET /api/routing/proxies round-trips nginxpilot', res.status === 200 && Array.isArray(body), {
            status: res.status,
            body,
        })
    }

    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(fail === 0 ? 0 : 1)
}

main().catch((err) => {
    console.error('e2e crashed:', err)
    process.exit(1)
})
