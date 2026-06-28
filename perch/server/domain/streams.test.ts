// Unit coverage for the pure L4 stream decisions behind the stream half of
// `services/routing.ts`. Mirrors `routing.test.ts` (http) and the daemon's
// `internal/config/validate.go` stream rules, plus the exact YAML the
// `POST /streams` / `POST /stream-upstreams` admin endpoints parse.

import { describe, it, expect } from 'vitest'
import {
    parseStream,
    parseStreamUpstream,
    renderStreamFragment,
    renderStreamUpstreamFragment,
} from './streams'

describe('parseStreamUpstream', () => {
    it('normalizes a valid pool, dropping the round_robin default (and never a keepalive)', () => {
        const r = parseStreamUpstream({
            name: 'db_pool',
            balancer: 'round_robin',
            servers: [{ address: '10.0.0.1:5432' }, { address: '10.0.0.2:5432', weight: 2, backup: true }],
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.value).toEqual({
            name: 'db_pool',
            servers: [{ address: '10.0.0.1:5432' }, { address: '10.0.0.2:5432', weight: 2, backup: true }],
        })
        expect('keepalive' in r.value).toBe(false)
    })

    it('keeps the stream-only `hash` balancer (NOT ip_hash)', () => {
        const r = parseStreamUpstream({ name: 'p', balancer: 'hash', servers: [{ address: 'a:1' }] })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.value.balancer).toBe('hash')
    })

    it('rejects ip_hash (an http-only balancer) and other unknowns', () => {
        expect(parseStreamUpstream({ name: 'p', balancer: 'ip_hash', servers: [{ address: 'a:1' }] })).toMatchObject({
            ok: false,
            reason: 'bad_balancer',
        })
    })

    it('rejects a bad name and a missing server set', () => {
        expect(parseStreamUpstream({ name: 'has-dash', servers: [{ address: 'a:1' }] })).toMatchObject({
            ok: false,
            reason: 'bad_name',
        })
        expect(parseStreamUpstream({ name: 'p', servers: [] })).toMatchObject({ ok: false, reason: 'no_servers' })
    })
})

describe('parseStream', () => {
    it('normalizes a tcp upstream stream, dropping tcp/off defaults', () => {
        const r = parseStream({ name: 'postgres', listen: 5432, protocol: 'tcp', upstream: 'db_pool' })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.value).toEqual({ name: 'postgres', listen: 5432, upstream: 'db_pool' })
    })

    it('keeps udp, an inline host:port pass, and the timeouts/proxy_protocol', () => {
        const r = parseStream({
            name: 'dns',
            listen: 53,
            protocol: 'udp',
            pass: '10.0.0.9:53',
            proxy_protocol: true,
            connect_timeout: '5s',
            timeout: '10m',
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.value).toEqual({
            name: 'dns',
            listen: 53,
            protocol: 'udp',
            pass: '10.0.0.9:53',
            proxy_protocol: true,
            connect_timeout: '5s',
            timeout: '10m',
        })
    })

    it('requires exactly one of upstream/pass', () => {
        expect(parseStream({ name: 's', listen: 1 })).toMatchObject({ ok: false, reason: 'bad_target' })
        expect(parseStream({ name: 's', listen: 1, upstream: 'p', pass: 'x:1' })).toMatchObject({
            ok: false,
            reason: 'bad_target',
        })
    })

    it('rejects a pass that is a URL rather than host:port', () => {
        expect(parseStream({ name: 's', listen: 1, pass: 'http://x:1' })).toMatchObject({ ok: false, reason: 'bad_pass' })
        expect(parseStream({ name: 's', listen: 1, pass: 'justhost' })).toMatchObject({ ok: false, reason: 'bad_pass' })
    })

    it('validates name regex, listen range, and protocol', () => {
        expect(parseStream({ name: 'bad name', listen: 1, upstream: 'p' })).toMatchObject({ ok: false, reason: 'bad_name' })
        expect(parseStream({ name: 's', listen: 70000, upstream: 'p' })).toMatchObject({ ok: false, reason: 'bad_listen' })
        expect(parseStream({ name: 's', upstream: 'p' })).toMatchObject({ ok: false, reason: 'bad_listen' })
        expect(parseStream({ name: 's', listen: 1, protocol: 'sctp', upstream: 'p' })).toMatchObject({
            ok: false,
            reason: 'bad_protocol',
        })
    })

    it('requires tls_domain when tls is auto|required, and keeps both', () => {
        expect(parseStream({ name: 's', listen: 1, upstream: 'p', tls: 'auto' })).toMatchObject({
            ok: false,
            reason: 'tls_domain_required',
        })
        const r = parseStream({ name: 's', listen: 5432, upstream: 'p', tls: 'required', tls_domain: 'db.example.com' })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(r.value).toMatchObject({ tls: 'required', tls_domain: 'db.example.com' })
    })
})

describe('render fragments', () => {
    it('renders a stream upstream matching the POST /stream-upstreams schema', () => {
        const r = parseStreamUpstream({
            name: 'db_pool',
            balancer: 'least_conn',
            servers: [{ address: '10.0.0.1:5432' }, { address: '10.0.0.2:5432', weight: 2, max_fails: 3, fail_timeout: '30s' }],
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(renderStreamUpstreamFragment(r.value)).toBe(
            [
                '# generated by Perch; managed automatically, do not edit by hand.',
                'stream_upstreams:',
                '  - name: db_pool',
                '    balancer: least_conn',
                '    servers:',
                '      - address: 10.0.0.1:5432',
                '      - address: 10.0.0.2:5432',
                '        weight: 2',
                '        max_fails: 3',
                '        fail_timeout: 30s',
                '',
            ].join('\n'),
        )
    })

    it('renders a TLS udp stream matching the POST /streams schema', () => {
        const r = parseStream({
            name: 'postgres',
            listen: 5432,
            protocol: 'udp',
            upstream: 'db_pool',
            proxy_protocol: true,
            connect_timeout: '5s',
            timeout: '10m',
            tls: 'auto',
            tls_domain: 'db.example.com',
        })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        expect(renderStreamFragment(r.value)).toBe(
            [
                '# generated by Perch; managed automatically, do not edit by hand.',
                'streams:',
                '  - name: postgres',
                '    listen: 5432',
                '    protocol: udp',
                '    upstream: db_pool',
                '    proxy_protocol: true',
                '    connect_timeout: 5s',
                '    timeout: 10m',
                '    tls: auto',
                '    tls_domain: db.example.com',
                '',
            ].join('\n'),
        )
    })

    it('omits the tcp default and renders an inline pass', () => {
        const r = parseStream({ name: 'redis', listen: 6379, pass: '10.0.0.9:6379' })
        expect(r.ok).toBe(true)
        if (!r.ok) return
        const yaml = renderStreamFragment(r.value)
        expect(yaml).not.toContain('protocol:')
        expect(yaml).toContain('    pass: 10.0.0.9:6379')
    })
})
