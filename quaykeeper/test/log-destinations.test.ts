import { describe, it, expect } from 'vitest'
import {
    parseLogDestination,
    renderLogDestFragment,
    logDestFragmentFilename,
    logqlSelector,
    type LogDestination,
} from '@/server/domain/nginxpilot-logdest-fragment'

/** Convenience: parse, assert failure, return the reason for a terse assertion. */
function reasonOf(input: unknown): string {
    const r = parseLogDestination(input)
    if (r.ok) throw new Error('expected validation to fail')
    return r.reason
}

/** Convenience: parse and return the validated value (throws on failure). */
function ok(input: unknown): LogDestination {
    const r = parseLogDestination(input)
    if (!r.ok) throw new Error(`expected ok, got ${r.reason}: ${r.message}`)
    return r.value
}

describe('parseLogDestination', () => {
    it('accepts a minimal loki destination', () => {
        const d = ok({ name: 'main', type: 'loki', url: 'https://loki.example.com/loki/api/v1/push' })
        expect(d.name).toBe('main')
        expect(d.type).toBe('loki')
        expect(d.url).toBe('https://loki.example.com/loki/api/v1/push')
    })

    it('enforces the slug name rule (fragment filename safety)', () => {
        expect(reasonOf({ name: 'Bad_Name', type: 'stdout' })).toBe('bad_name')
        expect(reasonOf({ name: '../etc', type: 'stdout' })).toBe('bad_name')
        expect(reasonOf({ type: 'stdout' })).toBe('name_required')
    })

    it('rejects unknown / missing types', () => {
        expect(reasonOf({ name: 'x', type: 'kafka' })).toBe('bad_type')
        expect(reasonOf({ name: 'x' })).toBe('type_required')
    })

    it('requires https unless allow_insecure', () => {
        expect(reasonOf({ name: 'x', type: 'loki', url: 'http://loki:3100/x' })).toBe('insecure_url')
        expect(ok({ name: 'x', type: 'loki', url: 'http://loki:3100/x', allow_insecure: true }).allow_insecure).toBe(true)
        expect(reasonOf({ name: 'x', type: 'loki', url: 'ftp://loki/x' })).toBe('bad_scheme')
        expect(reasonOf({ name: 'x', type: 'loki' })).toBe('url_required')
    })

    it('rejects inline secrets — refs only', () => {
        expect(
            reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', auth: { method: 'basic', username: 'u', password: 'hunter2' } }),
        ).toBe('inline_secret')
    })

    it('validates basic vs bearer auth ref shape', () => {
        expect(ok({ name: 'x', type: 'loki', url: 'https://l/x', auth: { method: 'basic', username: 'u', password_env: 'P' } }).auth?.password_env).toBe('P')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', auth: { method: 'basic', username: 'u' } })).toBe('one_password_ref')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', auth: { method: 'basic', password_env: 'P' } })).toBe('username_required')
        expect(ok({ name: 'x', type: 'http', url: 'https://c/x', auth: { method: 'bearer', token_env: 'T' } }).auth?.token_env).toBe('T')
        expect(reasonOf({ name: 'x', type: 'http', url: 'https://c/x', auth: { method: 'bearer', token_env: 'T', token_file: '/f' } })).toBe('one_token_ref')
    })

    it('enforces the loki label contract (G15/G16)', () => {
        expect(ok({ name: 'x', type: 'loki', url: 'https://l/x', labels: { job: 'nginx', host: '$resource', status_code: '$status' } }).labels?.host).toBe('$resource')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: { job: '$host' } })).toBe('bad_job')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: { host: '$remote_addr' } })).toBe('bad_host_label')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: { status_code: '$path' } })).toBe('bad_status_label')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: { region: '$host' } })).toBe('dynamic_extra')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: { '1bad': 'v' } })).toBe('bad_label_name')
        const many = Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`k${i}`, `v${i}`]))
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', labels: many })).toBe('too_many_labels')
    })

    it('rejects labels/tenant on http (collector gets the whole line)', () => {
        expect(reasonOf({ name: 'x', type: 'http', url: 'https://c/x', labels: { job: 'a' } })).toBe('http_labels')
        expect(reasonOf({ name: 'x', type: 'http', url: 'https://c/x', tenant: 't' })).toBe('http_tenant')
    })

    it('validates file destinations', () => {
        expect(ok({ name: 'x', type: 'file', path: '/var/log/np/a.ndjson', max_files: 5 }).path).toBe('/var/log/np/a.ndjson')
        expect(reasonOf({ name: 'x', type: 'file' })).toBe('path_required')
        expect(reasonOf({ name: 'x', type: 'file', path: 'rel/path' })).toBe('rel_path')
        expect(reasonOf({ name: 'x', type: 'file', path: '/a', url: 'https://l/x' })).toBe('local_push_fields')
    })

    it('rejects push-only fields on stdout/file', () => {
        expect(reasonOf({ name: 'x', type: 'stdout', url: 'https://l/x' })).toBe('local_push_fields')
        expect(reasonOf({ name: 'x', type: 'stdout', path: '/a' })).toBe('stdout_file_fields')
    })

    it('validates the filter map against the access field set', () => {
        expect(ok({ name: 'x', type: 'stdout', filter: { status: ['4xx', '5xx'], path: ['!/healthz'] } }).filter?.status).toEqual(['4xx', '5xx'])
        expect(reasonOf({ name: 'x', type: 'stdout', filter: { bogus: ['x'] } })).toBe('bad_filter_field')
        expect(reasonOf({ name: 'x', type: 'stdout', filter: { status: [] } })).toBe('empty_matchers')
    })

    it('validates parse templates (client CompileTemplate rules)', () => {
        expect(
            ok({ name: 'x', type: 'loki', url: 'https://l/x', parse: ['{level} | {time} - {message}'] }).parse,
        ).toEqual(['{level} | {time} - {message}'])
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', parse: ['no fields here'] })).toBe('bad_parse_template')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', parse: ['{a}{b}'] })).toBe('bad_parse_template') // adjacent
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', parse: ['{bad-name}'] })).toBe('bad_parse_template')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', parse: ['{unclosed'] })).toBe('bad_parse_template')
        expect(reasonOf({ name: 'x', type: 'loki', url: 'https://l/x', parse: 'nope' })).toBe('bad_parse')
    })

    it('validates sample range', () => {
        expect(ok({ name: 'x', type: 'stdout', sample: 0.1 }).sample).toBe(0.1)
        expect(reasonOf({ name: 'x', type: 'stdout', sample: 0 })).toBe('bad_sample')
        expect(reasonOf({ name: 'x', type: 'stdout', sample: 1.5 })).toBe('bad_sample')
    })
})

describe('renderLogDestFragment', () => {
    it('renders a full loki destination as YAML (secrets by reference)', () => {
        const d = ok({
            name: 'main-loki',
            type: 'loki',
            url: 'https://loki.example.com/loki/api/v1/push',
            tenant: 'infra',
            auth: { method: 'basic', username: 'loki', password_env: 'LOKI_PASSWORD' },
            labels: { job: 'nginx', host: '$resource', status_code: '$status' },
            filter: { status: ['4xx', '5xx'], path: ['!/healthz'] },
            batch_size: 500,
            flush_interval: '2s',
        })
        const yaml = renderLogDestFragment(d)
        expect(yaml).toContain('log_destinations:')
        expect(yaml).toContain('  - name: main-loki')
        expect(yaml).toContain('    type: loki')
        expect(yaml).toContain('    tenant: infra')
        expect(yaml).toContain('      method: basic')
        expect(yaml).toContain('      password_env: LOKI_PASSWORD')
        expect(yaml).toContain('      job: nginx')
        expect(yaml).toContain('      host: "$resource"') // leading $ forces quoting
        expect(yaml).toContain('      status_code: "$status"')
        expect(yaml).toContain('      status:')
        expect(yaml).toContain('        - 4xx')
        expect(yaml).toContain('        - "!/healthz"') // ! forces quoting
        expect(yaml).toContain('    batch_size: 500')
        expect(yaml).toContain('    flush_interval: 2s')
        // Never emits a secret value — only the env-name reference.
        expect(yaml).not.toContain('hunter2')
        expect(yaml.endsWith('\n')).toBe(true)
    })

    it('renders a file destination', () => {
        const yaml = renderLogDestFragment(ok({ name: 'audit', type: 'file', path: '/var/log/np/5xx.ndjson', filter: { status: ['>=500'] } }))
        expect(yaml).toContain('    type: file')
        expect(yaml).toContain('    path: "/var/log/np/5xx.ndjson"') // leading / forces quoting
        expect(yaml).toContain('        - ">=500"')
    })

    it('omits enabled unless explicitly false', () => {
        expect(renderLogDestFragment(ok({ name: 'a', type: 'stdout' }))).not.toContain('enabled:')
        expect(renderLogDestFragment(ok({ name: 'a', type: 'stdout', enabled: false }))).toContain('    enabled: false')
    })
})

describe('logDestFragmentFilename', () => {
    it('derives logdest-<name>.yml and rejects unsafe names', () => {
        expect(logDestFragmentFilename('main-loki')).toBe('logdest-main-loki.yml')
        expect(() => logDestFragmentFilename('../etc')).toThrow()
    })
})

describe('logqlSelector', () => {
    it('renders a stream selector: static exact, dynamic as any-value', () => {
        const d = ok({ name: 'x', type: 'loki', url: 'https://l/x', labels: { job: 'nginx', host: '$resource', instance: 'edge-1' } })
        expect(logqlSelector(d)).toBe('{job="nginx", host=~".+", instance="edge-1"}')
    })
    it('defaults job to nginx', () => {
        expect(logqlSelector(ok({ name: 'x', type: 'loki', url: 'https://l/x' }))).toBe('{job="nginx"}')
    })
})
