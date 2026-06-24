import { describe, it, expect } from 'vitest'
import escapeHtml from '../src/escapeHtml'

describe('escapeHtml', () => {

    it('escapes ampersand &', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b')
    })

    it('escapes less-than <', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    })

    it('escapes greater-than >', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b')
    })

    it('escapes double quote "', () => {
        expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;')
    })

    it("escapes single quote '", () => {
        expect(escapeHtml("it's")).toBe('it&#39;s')
    })

    it('escapes all five special characters in one string', () => {
        expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;')
    })

    it('escapes a typical XSS payload', () => {
        const raw = '<script>alert("XSS")</script>'
        const escaped = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
        expect(escapeHtml(raw)).toBe(escaped)
    })

    it('returns empty string for empty input', () => {
        expect(escapeHtml('')).toBe('')
    })

    it('leaves safe characters unchanged', () => {
        expect(escapeHtml('hello world 123')).toBe('hello world 123')
    })

    it('handles multiple consecutive special characters', () => {
        expect(escapeHtml('&&<<>>')).toBe('&amp;&amp;&lt;&lt;&gt;&gt;')
    })

})
