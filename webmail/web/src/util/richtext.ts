// Serialises the compose editor's contentEditable DOM into a restricted HTML
// subset plus a text/plain alternative. Anything outside the subset is reduced
// to its text, so pasted or browser-generated markup never reaches the wire.

const BLOCK = new Set(['P', 'DIV', 'BLOCKQUOTE', 'UL', 'OL', 'LI'])

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function safeHref(href: string | null): string | null {
    if (!href) return null
    try {
        const u = new URL(href, 'https://invalid.invalid/')
        if (u.hostname === 'invalid.invalid') return null
        return ['http:', 'https:', 'mailto:'].includes(u.protocol) ? u.href : null
    } catch {
        return null
    }
}

function serialiseHtml(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent ?? '')
    if (node.nodeType !== Node.ELEMENT_NODE) return ''
    const el = node as HTMLElement
    const inner = Array.from(el.childNodes).map(serialiseHtml).join('')
    switch (el.tagName) {
        case 'B':
        case 'STRONG':
            return `<strong>${inner}</strong>`
        case 'I':
        case 'EM':
            return `<em>${inner}</em>`
        case 'UL':
            return `<ul>${inner}</ul>`
        case 'OL':
            return `<ol>${inner}</ol>`
        case 'LI':
            return `<li>${inner}</li>`
        case 'BLOCKQUOTE':
            return `<blockquote>${inner}</blockquote>`
        case 'BR':
            return '<br>'
        case 'P':
        case 'DIV':
            return `<div>${inner || '<br>'}</div>`
        case 'A': {
            const href = safeHref(el.getAttribute('href'))
            return href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner
        }
        default:
            return inner
    }
}

type TextCtx = { quote: number; list: { ordered: boolean; n: number }[] }

function serialiseText(node: Node, ctx: TextCtx, out: string[]): void {
    if (node.nodeType === Node.TEXT_NODE) {
        out.push(node.textContent ?? '')
        return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as HTMLElement
    const tag = el.tagName
    const newline = () => {
        if (out.length && !out[out.length - 1].endsWith('\n')) out.push('\n')
    }
    if (tag === 'BR') {
        out.push('\n')
        return
    }
    if (tag === 'UL' || tag === 'OL') {
        newline()
        ctx.list.push({ ordered: tag === 'OL', n: 0 })
        el.childNodes.forEach((c) => serialiseText(c, ctx, out))
        ctx.list.pop()
        newline()
        return
    }
    if (tag === 'LI') {
        newline()
        const l = ctx.list[ctx.list.length - 1]
        const indent = '  '.repeat(Math.max(0, ctx.list.length - 1))
        if (l) l.n += 1
        out.push(indent + (l?.ordered ? `${l.n}. ` : '- '))
        el.childNodes.forEach((c) => serialiseText(c, ctx, out))
        newline()
        return
    }
    if (tag === 'BLOCKQUOTE') {
        newline()
        const sub: string[] = []
        el.childNodes.forEach((c) => serialiseText(c, { ...ctx, quote: 0 }, sub))
        const quoted = sub
            .join('')
            .replace(/\n+$/, '')
            .split('\n')
            .map((line) => (line.startsWith('>') ? '>' + line : '> ' + line))
            .join('\n')
        out.push(quoted + '\n')
        return
    }
    if (tag === 'A') {
        const href = safeHref(el.getAttribute('href'))
        const text = el.textContent ?? ''
        out.push(href && href !== text && `mailto:${text}` !== href ? `${text} <${href}>` : text)
        return
    }
    if (BLOCK.has(tag)) newline()
    el.childNodes.forEach((c) => serialiseText(c, ctx, out))
    if (BLOCK.has(tag)) newline()
}

export function serialiseEditor(root: HTMLElement): { html: string; text: string } {
    const html = Array.from(root.childNodes).map(serialiseHtml).join('')
    const out: string[] = []
    root.childNodes.forEach((c) => serialiseText(c, { quote: 0, list: [] }, out))
    const text = out.join('').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '')
    return { html, text }
}

/** Plain text → editor HTML (escaped, line breaks kept). */
export function textToHtml(text: string): string {
    return text
        .split('\n')
        .map((line) => `<div>${line ? escapeHtml(line) : '<br>'}</div>`)
        .join('')
}

/** Prefix every line with "> " for a plain-text quote. */
export function quoteText(text: string): string {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/\n+$/, '')
        .split('\n')
        .map((l) => (l.startsWith('>') ? '>' + l : '> ' + l))
        .join('\n')
}

/**
 * Any HTML (typed in the source view, or a stored draft) → the restricted subset the editor and the wire accept,
 * plus its text alternative. Parsed inert (no script runs, no image loads); everything outside the subset
 * is reduced to its text, and scripts, styles, event handlers and unsafe links are gone.
 */
export function normaliseHtml(src: string): { html: string; text: string } {
    const doc = new DOMParser().parseFromString(src, 'text/html')
    doc.querySelectorAll('script, style, head, template, noscript').forEach((n) => n.remove())
    const walk = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
    const blank: Node[] = []
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (/^\s*\n\s*$/.test(n.textContent ?? '')) blank.push(n)
    }
    blank.forEach((n) => n.parentNode?.removeChild(n))
    return serialiseEditor(doc.body)
}

/** Source view layout: one block per line. Whitespace between tags is dropped again by normaliseHtml. */
export function prettyHtml(html: string): string {
    return html
        .replace(/>\n+</g, '><')
        .replace(/<\/(div|li|ul|ol|blockquote)>/g, '</$1>\n')
        .replace(/<(ul|ol)>/g, '<$1>\n')
        .replace(/\n+$/, '')
}
