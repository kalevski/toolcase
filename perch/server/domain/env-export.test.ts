import { describe, it, expect } from 'vitest'
import { toJson, type ExportEntry } from '@/server/domain/env-export'

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
        const entries: ExportEntry[] = [{ key: 'API_KEY', value: '<hidden:STRIPE_KEY>' }]
        expect(toJson(entries)).toBe('{\n  "API_KEY": "<hidden:STRIPE_KEY>"\n}\n')
    })
})
