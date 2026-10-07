// Single source of truth for URLs that reach a navigation or resource sink
// (`href`, `src`, `poster`, `action`). A consumer string is trusted for display,
// never for its scheme: `javascript:`, `vbscript:` and `data:` documents are
// dropped, and so are protocol-relative `//host` forms.
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])
const STRIP = /[\x00-\x20\x7f-\x9f\s]/g
const SCHEME = /^([a-z][a-z0-9+.-]*:)/
const RELATIVE_PREFIX = /^(\/(?![/\\])|\.\/|\.\.\/|#|\?)/
const IMAGE_DATA = /^data:image\/(png|jpe?g|gif|webp|avif|bmp|x-icon|svg\+xml)[;,]/

/**
 * The trimmed URL when it is relative or uses http, https, mailto or tel, else `''`.
 *
 * Whitespace and control characters are removed and the scheme is case-folded
 * before it is compared, so `JaVaScRiPt:` and `java\tscript:` are rejected like
 * `javascript:`.
 */
export function safeUrl(value: string | null | undefined): string {
    if (value === null || value === undefined) return ''
    const trimmed = String(value).trim()
    if (trimmed === '') return ''
    const normalized = trimmed.replace(STRIP, '').toLowerCase()
    if (/^[/\\]{2}/.test(normalized) || normalized.startsWith('\\')) return ''
    if (RELATIVE_PREFIX.test(normalized)) return trimmed
    const scheme = SCHEME.exec(normalized)
    if (scheme) return ALLOWED_SCHEMES.has(scheme[1]) ? trimmed : ''
    return trimmed
}

/** {@link safeUrl} for image sources, which may also be `blob:` or `data:image/*` URLs. */
export function safeImgSrc(value: string | null | undefined): string {
    const url = safeUrl(value)
    if (url !== '' || value === null || value === undefined) return url
    const normalized = String(value).trim().replace(STRIP, '').toLowerCase()
    if (normalized.startsWith('blob:') || IMAGE_DATA.test(normalized)) return String(value).trim()
    return ''
}

/** {@link safeImgSrc} percent-encoded so it cannot leave a CSS `url(...)` token, or `''`. */
export function safeCssUrl(value: string | null | undefined): string {
    const url = safeImgSrc(value)
    if (url === '') return ''
    return url.replace(/[\s"'()\\<>]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'))
}
