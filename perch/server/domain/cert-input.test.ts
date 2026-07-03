// Unit coverage for the pure cert-input rules (cert_feature.md). The `services/certs.ts`
// wrapper can't be imported under vitest (its `server-only` guard throws), so the
// load-bearing decisions — domain normalization (incl. the leading-wildcard special case),
// issue-set de-duplication, provider-name validation, and the per-shape credential
// pre-checks — are exercised here directly.

import { describe, it, expect } from 'vitest'
import {
    CertInputError,
    isWildcard,
    normalizeCertDomain,
    parseDomains,
    validateIssueDomains,
    validateIssueEmail,
    validateProvider,
    providerSpec,
    mechanismLabel,
    validateCredentialRequest,
    KNOWN_PROVIDERS,
    INI_TEMPLATE_PROVIDERS,
    PROVIDER_PATTERN,
    iniTemplate,
    renderIniCredentials,
} from './cert-input'

describe('normalizeCertDomain', () => {
    it('lowercases, trims, and drops a trailing dot', () => {
        expect(normalizeCertDomain('  Www.Example.COM.  ')).toBe('www.example.com')
    })

    it('accepts a single leading wildcard', () => {
        expect(normalizeCertDomain('*.Example.com')).toBe('*.example.com')
        expect(isWildcard(normalizeCertDomain('*.example.com'))).toBe(true)
    })

    it('rejects an empty domain', () => {
        expect(() => normalizeCertDomain('   ')).toThrow(CertInputError)
    })

    it('rejects a wildcard that is not a single leading "*."', () => {
        expect(() => normalizeCertDomain('foo.*.example.com')).toThrow(/single leading/)
        expect(() => normalizeCertDomain('**.example.com')).toThrow(CertInputError)
    })

    it('rejects a malformed host', () => {
        expect(() => normalizeCertDomain('not a domain')).toThrow(CertInputError)
        expect(() => normalizeCertDomain('localhost')).toThrow(CertInputError)
    })
})

describe('parseDomains', () => {
    it('splits on commas, spaces, and newlines', () => {
        expect(parseDomains('a.com, b.com\n c.com')).toEqual(['a.com', 'b.com', 'c.com'])
    })
    it('drops empty fragments', () => {
        expect(parseDomains('  , ,a.com,')).toEqual(['a.com'])
    })
})

describe('validateIssueDomains', () => {
    it('normalizes and de-duplicates while preserving order', () => {
        expect(validateIssueDomains('Example.com, www.example.com, example.com')).toEqual([
            'example.com',
            'www.example.com',
        ])
    })

    it('accepts an array body and a wildcard apex pair', () => {
        expect(validateIssueDomains(['example.com', '*.example.com'])).toEqual([
            'example.com',
            '*.example.com',
        ])
    })

    it('rejects an empty set', () => {
        expect(() => validateIssueDomains('')).toThrow(/at least one domain/)
        expect(() => validateIssueDomains([])).toThrow(CertInputError)
    })

    it('rejects when any domain is malformed', () => {
        expect(() => validateIssueDomains('good.com, bad domain')).toThrow(CertInputError)
    })
})

describe('validateIssueEmail', () => {
    it('trims and accepts a well-formed address', () => {
        expect(validateIssueEmail('  ops@example.com ')).toBe('ops@example.com')
    })
    it('rejects empty and malformed addresses', () => {
        expect(() => validateIssueEmail('')).toThrow(/email is required/)
        expect(() => validateIssueEmail('   ')).toThrow(CertInputError)
        expect(() => validateIssueEmail('not-an-email')).toThrow(/invalid email/)
        expect(() => validateIssueEmail('a@b')).toThrow(CertInputError)
    })
})

describe('validateProvider', () => {
    it('lowercases and trims a valid provider', () => {
        expect(validateProvider('  Cloudflare ')).toBe('cloudflare')
        expect(validateProvider('dns-rfc2136')).toBe('dns-rfc2136')
    })
    it('rejects names outside [a-z0-9-]', () => {
        expect(() => validateProvider('route 53')).toThrow(CertInputError)
        expect(() => validateProvider('../etc')).toThrow(CertInputError)
        expect(() => validateProvider('UPPER_case')).toThrow(CertInputError)
    })
})

describe('providerSpec / mechanismLabel', () => {
    it('resolves a known provider and its shape', () => {
        expect(providerSpec('route53')?.shape).toBe('aws')
        expect(providerSpec('google')?.shape).toBe('google')
        expect(providerSpec('digitalocean')?.shape).toBe('token')
    })
    it('returns undefined for an unknown provider', () => {
        expect(providerSpec('hetzner')).toBeUndefined()
    })
    it('labels every mechanism, defaulting unknown to the file form', () => {
        expect(mechanismLabel('aws-file')).toMatch(/AWS/)
        expect(mechanismLabel('google')).toMatch(/JSON/)
        expect(mechanismLabel('flag')).toMatch(/file/i)
        expect(mechanismLabel('something-else')).toMatch(/file/i)
    })
})

describe('validateCredentialRequest', () => {
    it('accepts a raw body for any provider', () => {
        expect(() => validateCredentialRequest('hetzner', { credentials: 'dns_hetzner_api_token = x' })).not.toThrow()
        expect(() => validateCredentialRequest('cloudflare', { credentials: 'anything' })).not.toThrow()
    })

    it('requires the token for a token-shape provider', () => {
        expect(() => validateCredentialRequest('cloudflare', { token: 'abc' })).not.toThrow()
        expect(() => validateCredentialRequest('cloudflare', {})).toThrow(/token/)
    })

    it('requires both keys for route53', () => {
        expect(() => validateCredentialRequest('route53', { access_key: 'A', secret_key: 'B' })).not.toThrow()
        expect(() => validateCredentialRequest('route53', { access_key: 'A' })).toThrow(CertInputError)
    })

    it('requires service-account JSON for google', () => {
        expect(() => validateCredentialRequest('google', { service_account_json: '{}' })).not.toThrow()
        expect(() => validateCredentialRequest('google', {})).toThrow(CertInputError)
    })

    it('rejects an unknown provider with no raw body', () => {
        expect(() => validateCredentialRequest('hetzner', { token: 'x' })).toThrow(/raw credentials/)
    })

    it('every known provider has a label, id, and shape', () => {
        for (const p of KNOWN_PROVIDERS) {
            expect(p.id).toMatch(/^[a-z0-9-]+$/)
            expect(p.label.length).toBeGreaterThan(0)
            expect(['token', 'aws', 'google', 'raw']).toContain(p.shape)
        }
    })
})

// ── raw-INI field templates (perch_better.md C4) ─────────────────────────────────

describe('renderIniCredentials', () => {
    const ovh = iniTemplate('ovh')!

    it('assembles the plugin-documented INI body from filled fields', () => {
        expect(
            renderIniCredentials(ovh, {
                dns_ovh_endpoint: 'ovh-eu',
                dns_ovh_application_key: 'appkey',
                dns_ovh_application_secret: 'appsecret',
                dns_ovh_consumer_key: 'consumer',
            }),
        ).toBe(
            [
                'dns_ovh_endpoint = ovh-eu',
                'dns_ovh_application_key = appkey',
                'dns_ovh_application_secret = appsecret',
                'dns_ovh_consumer_key = consumer',
                '',
            ].join('\n'),
        )
    })

    it('drops a blank optional field but throws on a blank required one', () => {
        const rfc = iniTemplate('rfc2136')!
        const body = renderIniCredentials(rfc, {
            dns_rfc2136_server: '192.0.2.1',
            dns_rfc2136_name: 'keyname',
            dns_rfc2136_secret: 's3cret',
            dns_rfc2136_algorithm: 'HMAC-SHA512',
        })
        expect(body).not.toContain('dns_rfc2136_port')
        expect(() => renderIniCredentials(ovh, { dns_ovh_endpoint: 'ovh-eu' })).toThrow(/required/)
    })

    it('rejects embedded newlines (INI has no escaping)', () => {
        const hetzner = iniTemplate('hetzner')!
        expect(() => renderIniCredentials(hetzner, { dns_hetzner_api_token: "tok\ndns_evil = 1" })).toThrow(
            /single line/,
        )
    })

    it('every template id is a valid certbot plugin name and none collides with a convenience shape', () => {
        for (const t of INI_TEMPLATE_PROVIDERS) {
            expect(t.id).toMatch(PROVIDER_PATTERN)
            expect(providerSpec(t.id)).toBeUndefined()
            expect(t.fields.length).toBeGreaterThan(0)
        }
    })
})
