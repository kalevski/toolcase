import { describe, it, expect } from 'vitest'
import { parse, stringify, type ParsedEnvEntry } from '@/server/domain/env-file'

describe('parse', () => {
    it('parses a plain KEY=value line', () => {
        expect(parse('FOO=bar')).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('strips an optional leading `export ` prefix', () => {
        expect(parse('export FOO=bar')).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('skips full-line # comments (after optional whitespace) and blank lines', () => {
        const text = ['# a comment', '   # indented comment', '', '   ', 'FOO=bar'].join('\n')
        expect(parse(text)).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('skips lines with no `=` and lines with an empty key', () => {
        const text = ['NOEQUALS', '=novalue', '   =x', 'FOO=bar'].join('\n')
        expect(parse(text)).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('trims whitespace around the key', () => {
        expect(parse('  FOO  =bar')).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('treats single-quoted values as literal (no escape processing)', () => {
        expect(parse("FOO='a\\nb # not a comment'")).toEqual([
            { key: 'FOO', value: 'a\\nb # not a comment' },
        ])
    })

    it('processes \\n \\t \\r \\\\ \\" escapes in double-quoted values', () => {
        expect(parse('FOO="a\\nb\\tc\\rd\\\\e\\"f"')).toEqual([
            { key: 'FOO', value: 'a\nb\tc\rd\\e"f' },
        ])
    })

    it('trims unquoted values', () => {
        expect(parse('FOO=   bar   ')).toEqual([{ key: 'FOO', value: 'bar' }])
    })

    it('preserves spaces inside a quoted value', () => {
        expect(parse('FOO="a b c"')).toEqual([{ key: 'FOO', value: 'a b c' }])
    })

    it('returns ALL entries in order without deduping', () => {
        const text = ['A=1', 'B=2', 'A=3'].join('\n')
        expect(parse(text)).toEqual([
            { key: 'A', value: '1' },
            { key: 'B', value: '2' },
            { key: 'A', value: '3' },
        ])
    })

    it('handles CRLF line endings', () => {
        expect(parse('A=1\r\nB=2')).toEqual([
            { key: 'A', value: '1' },
            { key: 'B', value: '2' },
        ])
    })
})

describe('stringify', () => {
    it('emits one KEY=value per line with a trailing newline', () => {
        expect(stringify([{ key: 'A', value: '1' }, { key: 'B', value: '2' }])).toBe('A=1\nB=2\n')
    })

    it('emits bare values when no quoting is needed', () => {
        expect(stringify([{ key: 'FOO', value: 'bar' }])).toBe('FOO=bar\n')
    })

    it('double-quotes empty values', () => {
        expect(stringify([{ key: 'FOO', value: '' }])).toBe('FOO=""\n')
    })

    it('double-quotes values containing whitespace, #, =, or quotes', () => {
        expect(stringify([{ key: 'FOO', value: 'a b' }])).toBe('FOO="a b"\n')
        expect(stringify([{ key: 'FOO', value: 'a#b' }])).toBe('FOO="a#b"\n')
        expect(stringify([{ key: 'FOO', value: 'a=b' }])).toBe('FOO="a=b"\n')
        expect(stringify([{ key: 'FOO', value: "a'b" }])).toBe('FOO="a\'b"\n')
    })

    it('escapes backslash, double-quote and newline when quoting', () => {
        expect(stringify([{ key: 'FOO', value: 'a\\b"c\nd' }])).toBe('FOO="a\\\\b\\"c\\nd"\n')
    })
})

describe('round-trip', () => {
    const cases: ParsedEnvEntry[][] = [
        [{ key: 'FOO', value: 'bar' }],
        [{ key: 'EMPTY', value: '' }],
        [{ key: 'SPACED', value: 'a b c' }],
        [{ key: 'HASH', value: 'a#b' }],
        [{ key: 'EQ', value: 'k=v' }],
        [{ key: 'MULTI', value: 'line1\nline2' }],
        [{ key: 'ESCAPES', value: 'tab\there\\and"quote' }],
        [
            { key: 'A', value: '1' },
            { key: 'B', value: 'x y' },
            { key: 'C', value: '' },
        ],
    ]

    it('parse(stringify(x)) returns the original entries', () => {
        for (const entries of cases) {
            expect(parse(stringify(entries))).toEqual(entries)
        }
    })

    it('round-trips a multiline value carried via \\n', () => {
        const out = stringify([{ key: 'MULTI', value: 'one\ntwo' }])
        expect(out).toBe('MULTI="one\\ntwo"\n')
        expect(parse(out)).toEqual([{ key: 'MULTI', value: 'one\ntwo' }])
    })
})
