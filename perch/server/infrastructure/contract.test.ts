// Contract-drift protection (perch_better.md B4). Perch hand-mirrors nginxpilot's
// admin JSON in `infrastructure/nginxpilot.ts` and `domain/routing.ts`; until the
// daemon serves a schema, these fixtures — recorded from the daemon build verified in
// the impl_plan curl pass — pin the shapes. A daemon field rename breaks a test here
// instead of a page: the fixtures are (1) statically checked against the TS types
// (`satisfies`, erased at runtime, so the `server-only` client module is never
// imported) and (2) re-parsed through the pure domain validators the UI uses on the
// round-trip path, proving a read-back entity can be POSTed again.

import { describe, it, expect } from 'vitest'
import type {
    NginxpilotStatus,
    NginxpilotCert,
    WriteResult,
} from '@/server/infrastructure/nginxpilot'
import {
    hstsEnabled,
    parseDeadHost,
    parseProxy,
    parseRedirect,
    renderDeadHostFragment,
    renderProxyFragment,
    renderRedirectFragment,
    type DeadHost,
    type Proxy,
    type Redirect,
} from '@/server/domain/routing'
import { parseAccessList, renderAccessListFragment, type AccessList } from '@/server/domain/access-list'
import statusFixture from './__fixtures__/status.json'
import accessListsFixture from './__fixtures__/access-lists.json'
import certsFixture from './__fixtures__/certs.json'
import redirectsFixture from './__fixtures__/redirects.json'
import deadHostsFixture from './__fixtures__/dead-hosts.json'
import proxiesFixture from './__fixtures__/proxies.json'
import writeWarningsFixture from './__fixtures__/write-warnings.json'

describe('GET /status contract', () => {
    it('deserializes into NginxpilotStatus with the at_risk/reconcile/certs_renewal fields', () => {
        const status = statusFixture as NginxpilotStatus
        expect(status.sites[0].domain).toBe('docs.example.com')
        expect(status.nginx?.managed).toBe(true)
        expect(status.nginx?.at_risk_count).toBe(1)
        expect(status.nginx?.disabled_count).toBe(1)

        const atRisk = status.nginx?.resources.find((r) => r.state === 'at_risk')
        expect(atRisk?.kind).toBe('proxy')
        expect(atRisk?.since).toBe('2026-07-01T09:00:00Z')
        expect(atRisk?.last_reconcile).toBeTruthy()

        expect(status.nginx?.reconcile?.on_failure).toBe('warn')
        expect(status.certs_renewal?.enabled).toBe(true)
        expect(status.certs_renewal?.renew_before).toBe('720h0m0s')

        // The real-ip summary (C2) rides the managed block.
        expect(status.nginx?.real_ip?.enabled).toBe(true)
        expect(status.nginx?.real_ip?.header).toBe('CF-Connecting-IP')
        expect(status.nginx?.real_ip?.range_count).toBe(22)
    })
})

describe('GET /access-lists contract', () => {
    it('every read-back list re-parses (masked users, no password material) and re-renders', () => {
        const lists = accessListsFixture.access_lists as AccessList[]
        expect(lists).toHaveLength(2)
        for (const l of lists) {
            const checked = parseAccessList(l)
            expect(checked.ok, `access list ${l.name} must re-parse`).toBe(true)
            if (checked.ok) {
                const yaml = renderAccessListFragment(checked.value)
                expect(yaml).toContain('access_lists:')
                expect(yaml).not.toContain('password') // usernames only — never hashes
            }
        }
        expect(lists[0].users?.[0].has_password).toBe(true)
    })
})

describe('GET /certs contract', () => {
    it('deserializes into NginxpilotCert[] with the renewal-scheduler enrichment', () => {
        const certs = certsFixture.certs as NginxpilotCert[]
        const managed = certs.find((c) => c.domain === 'example.com')
        expect(managed?.renew_managed).toBe(true)
        expect(managed?.expires_in_seconds).toBeGreaterThan(0)
        expect(managed?.last_renew_time).toBeTruthy()

        const manual = certs.find((c) => c.domain === 'manual.example.org')
        expect(manual?.renew_managed).toBe(false)
        expect(manual?.last_renew_error).toBeTruthy()
    })
})

describe('routing write-response contract', () => {
    it('the warnings-carrying JSON body matches WriteResult', () => {
        const result = writeWarningsFixture satisfies WriteResult
        expect(result.status).toBe('created')
        expect(result.warnings).toHaveLength(1)
    })
})

describe('GET /redirects contract', () => {
    it('every read-back redirect re-parses and re-renders (round-trip safe)', () => {
        const redirects = redirectsFixture.redirects as Redirect[]
        expect(redirects).toHaveLength(2)
        for (const r of redirects) {
            const checked = parseRedirect(r)
            expect(checked.ok, `redirect ${r.domain} must re-parse`).toBe(true)
            if (checked.ok) expect(renderRedirectFragment(checked.value)).toContain(`domain: `)
        }
        // The daemon's HSTS read-shape is the struct form — hstsEnabled folds it.
        expect(hstsEnabled(redirects[0].hsts)).toBe(true)
    })
})

describe('GET /dead-hosts contract', () => {
    it('every read-back dead host re-parses and re-renders (round-trip safe)', () => {
        const deadHosts = deadHostsFixture.dead_hosts as DeadHost[]
        expect(deadHosts).toHaveLength(2)
        for (const d of deadHosts) {
            const checked = parseDeadHost(d)
            expect(checked.ok, `dead host ${d.domain} must re-parse`).toBe(true)
            if (checked.ok) expect(renderDeadHostFragment(checked.value)).toContain('dead_hosts:')
        }
    })
})

describe('GET /proxies contract', () => {
    it('every read-back proxy re-parses and re-renders (round-trip safe)', () => {
        const proxies = proxiesFixture.proxies as Proxy[]
        expect(proxies).toHaveLength(2)
        for (const p of proxies) {
            const checked = parseProxy(p)
            expect(checked.ok, `proxy ${p.domain} must re-parse`).toBe(true)
            if (checked.ok) expect(renderProxyFragment(checked.value)).toContain('proxies:')
        }
        // The read shapes Perch must tolerate: struct HSTS, `cache: {}` for disabled,
        // Go-duration timeouts, wildcard domains, per-location advanced.
        const api = proxies[0]
        expect(hstsEnabled(api.hsts)).toBe(true)
        const reparsed = parseProxy(api)
        if (reparsed.ok) {
            expect(reparsed.value.cache).toBeUndefined() // {} normalizes away
            expect(reparsed.value.locations?.[1].advanced).toBe('proxy_buffering off;')
        }
        expect(parseProxy(proxies[1]).ok).toBe(true) // wildcard + disabled
    })
})
