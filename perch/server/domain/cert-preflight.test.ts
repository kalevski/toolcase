// Verdict-table coverage for the cert-issuance pre-flight classifier (B2).

import { describe, it, expect } from 'vitest'
import { classifyCertPreflight, wildcardPreflight } from './cert-preflight'

describe('classifyCertPreflight', () => {
    it('no DNS beats everything', () => {
        expect(
            classifyCertPreflight({ resolved: [], ingress: ['1.2.3.4'], challenge: 'reachable' }).verdict,
        ).toBe('no_dns')
    })

    it('flags a domain pointing at someone else when the ingress is known', () => {
        expect(
            classifyCertPreflight({ resolved: ['9.9.9.9'], ingress: ['1.2.3.4'], challenge: 'reachable' }).verdict,
        ).toBe('wrong_ingress')
    })

    it('skips the ingress comparison when the ingress is unknown', () => {
        expect(
            classifyCertPreflight({ resolved: ['9.9.9.9'], ingress: [], challenge: 'reachable' }).verdict,
        ).toBe('ok')
    })

    it('flags a routable domain whose port 80 does not answer', () => {
        expect(
            classifyCertPreflight({ resolved: ['1.2.3.4'], ingress: ['1.2.3.4'], challenge: 'unreachable' }).verdict,
        ).toBe('unreachable')
    })

    it('passes when any resolved record matches the ingress set (v4 or v6)', () => {
        expect(
            classifyCertPreflight({
                resolved: ['2001:db8::1', '1.2.3.4'],
                ingress: ['1.2.3.4', '2001:db8::1'],
                challenge: 'reachable',
            }).verdict,
        ).toBe('ok')
    })

    it('reports ok-with-caveat when the challenge probe was skipped', () => {
        const r = classifyCertPreflight({ resolved: ['1.2.3.4'], ingress: ['1.2.3.4'], challenge: 'skipped' })
        expect(r.verdict).toBe('ok')
        expect(r.detail).toContain('not probed')
    })

    it('wildcards short-circuit to the DNS-01 hint', () => {
        expect(wildcardPreflight().verdict).toBe('wildcard_needs_dns')
    })
})
