// Unit coverage for the pure hostname-namespace rules (§10, §16). The
// `services/domains.ts` wrapper can't be imported under vitest (its `server-only`
// guard throws), so the load-bearing decisions — label validation rejecting
// reserved/invalid input, and the DNS-verify decision failing closed when the
// answer doesn't match our ingress IP — are exercised here directly.

import { describe, it, expect } from 'vitest'
import { checkLabel, checkDomain, dnsPointsAt, RESERVED_LABELS } from './hostname'

describe('checkLabel', () => {
    it('accepts a plain DNS-safe label, normalizing case + surrounding space', () => {
        expect(checkLabel('alice')).toEqual({ ok: true, label: 'alice' })
        expect(checkLabel('  My-Site  ')).toEqual({ ok: true, label: 'my-site' })
        expect(checkLabel('a1')).toEqual({ ok: true, label: 'a1' })
    })

    it('rejects an empty / whitespace-only label', () => {
        expect(checkLabel('')).toMatchObject({ ok: false, reason: 'empty' })
        expect(checkLabel('   ')).toMatchObject({ ok: false, reason: 'empty' })
    })

    it('rejects a label longer than 63 characters', () => {
        expect(checkLabel('a'.repeat(64))).toMatchObject({ ok: false, reason: 'too_long' })
        expect(checkLabel('a'.repeat(63))).toEqual({ ok: true, label: 'a'.repeat(63) })
    })

    it('rejects non-DNS-safe charsets and bad hyphen placement', () => {
        expect(checkLabel('has space')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkLabel('under_score')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkLabel('-leading')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkLabel('trailing-')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkLabel('emoji😀')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkLabel('a.b')).toMatchObject({ ok: false, reason: 'charset' })
    })

    it('rejects reserved words (case-insensitively), including the spec four', () => {
        for (const word of ['www', 'api', 'admin', 'app']) {
            expect(checkLabel(word)).toMatchObject({ ok: false, reason: 'reserved' })
        }
        expect(checkLabel('ADMIN')).toMatchObject({ ok: false, reason: 'reserved' })
        expect(checkLabel('  Login ')).toMatchObject({ ok: false, reason: 'reserved' })
        // every reserved word is itself DNS-safe (so 'reserved', not 'charset', wins)
        for (const word of RESERVED_LABELS) {
            expect(checkLabel(word)).toMatchObject({ ok: false, reason: 'reserved' })
        }
    })
})

describe('checkDomain', () => {
    it('accepts a well-formed FQDN, normalizing case + a trailing dot', () => {
        expect(checkDomain('www.example.com')).toEqual({ ok: true, domain: 'www.example.com' })
        expect(checkDomain('Example.COM.')).toEqual({ ok: true, domain: 'example.com' })
        expect(checkDomain('a.b.c.example.co.uk')).toEqual({ ok: true, domain: 'a.b.c.example.co.uk' })
    })

    it('rejects an empty domain', () => {
        expect(checkDomain('')).toMatchObject({ ok: false, reason: 'empty' })
    })

    it('rejects a bare label, a numeric TLD, and unsafe charsets', () => {
        expect(checkDomain('example')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkDomain('example.123')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkDomain('exa mple.com')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkDomain('under_score.com')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkDomain('-bad.com')).toMatchObject({ ok: false, reason: 'charset' })
        expect(checkDomain('bad-.com')).toMatchObject({ ok: false, reason: 'charset' })
    })

    it('rejects an over-length domain', () => {
        const tooLong = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`
        expect(tooLong.length).toBeGreaterThan(253)
        expect(checkDomain(tooLong)).toMatchObject({ ok: false, reason: 'too_long' })
    })
})

describe('dnsPointsAt (fail-closed DNS verification)', () => {
    const ingress = '203.0.113.10'

    it('matches when the resolved set contains the ingress IP', () => {
        expect(dnsPointsAt(['203.0.113.10'], ingress)).toBe(true)
        expect(dnsPointsAt(['198.51.100.1', '203.0.113.10'], ingress)).toBe(true)
        expect(dnsPointsAt([' 203.0.113.10 '], ingress)).toBe(true) // tolerant of stray whitespace
    })

    it('fails closed when DNS does not match', () => {
        expect(dnsPointsAt(['198.51.100.1'], ingress)).toBe(false)
        expect(dnsPointsAt(['203.0.113.9'], ingress)).toBe(false)
    })

    it('fails closed on an empty/unknown answer (NXDOMAIN, no A record, resolver error)', () => {
        expect(dnsPointsAt([], ingress)).toBe(false)
    })

    it('fails closed when the ingress IP is unconfigured', () => {
        expect(dnsPointsAt(['203.0.113.10'], '')).toBe(false)
        expect(dnsPointsAt(['203.0.113.10'], '   ')).toBe(false)
    })
})
