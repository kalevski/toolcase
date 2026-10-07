import { describe, it, expect } from 'vitest'
import { safeUrl, safeImgSrc, safeCssUrl } from '../src/internal/safe-url'

describe('safeUrl', () => {
    it('rejects script-capable schemes', () => {
        expect(safeUrl('javascript:alert(1)')).toBe('')
        expect(safeUrl('JaVaScRiPt:alert(1)')).toBe('')
        expect(safeUrl('  javascript:alert(1)')).toBe('')
        expect(safeUrl('vbscript:msgbox(1)')).toBe('')
        expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('')
        expect(safeUrl('file:///etc/passwd')).toBe('')
    })

    it('rejects tab, newline and control character smuggling', () => {
        expect(safeUrl('java\tscript:alert(1)')).toBe('')
        expect(safeUrl('java\nscript:alert(1)')).toBe('')
        expect(safeUrl('java\r\nscript:alert(1)')).toBe('')
        expect(safeUrl('\u0001javascript:alert(1)')).toBe('')
    })

    it('rejects protocol-relative URLs', () => {
        expect(safeUrl('//evil.example')).toBe('')
        expect(safeUrl('/\\evil.example')).toBe('')
        expect(safeUrl('\\\\evil.example')).toBe('')
    })

    it('allows http, https, mailto and tel', () => {
        expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
        expect(safeUrl('HTTP://example.com')).toBe('HTTP://example.com')
        expect(safeUrl('mailto:a@example.com')).toBe('mailto:a@example.com')
        expect(safeUrl('tel:+123456')).toBe('tel:+123456')
    })

    it('allows relative references and trims them', () => {
        expect(safeUrl('/docs/a')).toBe('/docs/a')
        expect(safeUrl('./a')).toBe('./a')
        expect(safeUrl('../a')).toBe('../a')
        expect(safeUrl('#top')).toBe('#top')
        expect(safeUrl('?q=1')).toBe('?q=1')
        expect(safeUrl('  /docs  ')).toBe('/docs')
        expect(safeUrl('page.html')).toBe('page.html')
    })

    it('returns an empty string for empty or nullish input', () => {
        expect(safeUrl(undefined)).toBe('')
        expect(safeUrl(null)).toBe('')
        expect(safeUrl('   ')).toBe('')
    })
})

describe('safeImgSrc', () => {
    it('allows blob and data:image sources but not other data documents', () => {
        expect(safeImgSrc('blob:https://example.com/1')).toBe('blob:https://example.com/1')
        expect(safeImgSrc('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
        expect(safeImgSrc('data:text/html,<script>1</script>')).toBe('')
        expect(safeImgSrc('javascript:alert(1)')).toBe('')
        expect(safeImgSrc('/a.png')).toBe('/a.png')
    })
})

describe('safeCssUrl', () => {
    it('encodes characters that could leave a CSS url() token', () => {
        expect(safeCssUrl("/a.png');background:red;('")).toBe('/a.png%27%29%3Bbackground:red;%28%27'.replace('%3B', ';'))
        expect(safeCssUrl('javascript:alert(1)')).toBe('')
    })
})
