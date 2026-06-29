import { describe, it, expect } from 'vitest'
import { toJson, toCompose, type ExportEntry } from '@/server/domain/env-export'

describe('toJson', () => {
    it('renders a pretty 2-space object with a trailing newline', () => {
        const entries: ExportEntry[] = [
            { key: 'FOO', value: 'bar' },
            { key: 'NUM', value: '42' },
        ]
        expect(toJson(entries)).toBe('{\n  "FOO": "bar",\n  "NUM": "42"\n}\n')
    })

    it('preserves the given key order', () => {
        const entries: ExportEntry[] = [
            { key: 'ZED', value: '1' },
            { key: 'ALPHA', value: '2' },
        ]
        expect(toJson(entries)).toBe('{\n  "ZED": "1",\n  "ALPHA": "2"\n}\n')
    })

    it('escapes quotes, backslashes and newlines in values', () => {
        const entries: ExportEntry[] = [{ key: 'K', value: 'a"b\\c\nd' }]
        expect(toJson(entries)).toBe('{\n  "K": "a\\"b\\\\c\\nd"\n}\n')
    })

    it('emits {} with a trailing newline for no entries', () => {
        expect(toJson([])).toBe('{}\n')
    })

    it('renders a masked placeholder value verbatim (already masked by caller)', () => {
        const entries: ExportEntry[] = [{ key: 'API_KEY', value: '<hidden:stripe>' }]
        expect(toJson(entries)).toBe('{\n  "API_KEY": "<hidden:stripe>"\n}\n')
    })
})

describe('toCompose', () => {
    it('renders the environment: block with 6-space indented quoted mappings', () => {
        const entries: ExportEntry[] = [
            { key: 'FOO', value: 'bar' },
            { key: 'NUM', value: '42' },
        ]
        expect(toCompose(entries)).toBe(
            '    environment:\n      FOO: "bar"\n      NUM: "42"\n',
        )
    })

    it('always double-quotes a value containing a colon', () => {
        const entries: ExportEntry[] = [{ key: 'URL', value: 'postgres://u:p@host:5432/db' }]
        expect(toCompose(entries)).toBe(
            '    environment:\n      URL: "postgres://u:p@host:5432/db"\n',
        )
    })

    it('escapes embedded double-quotes and backslashes', () => {
        const entries: ExportEntry[] = [{ key: 'K', value: 'a"b\\c' }]
        expect(toCompose(entries)).toBe('    environment:\n      K: "a\\"b\\\\c"\n')
    })

    it('emits just the header (with trailing newline) for no entries', () => {
        expect(toCompose([])).toBe('    environment:\n')
    })

    it('renders a masked placeholder value verbatim', () => {
        const entries: ExportEntry[] = [{ key: 'TOKEN', value: '<hidden:gh>' }]
        expect(toCompose(entries)).toBe('    environment:\n      TOKEN: "<hidden:gh>"\n')
    })
})
