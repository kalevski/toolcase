import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-link'

export type LinkVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'
export type LinkUnderline = 'always' | 'hover' | 'none'

const VARIANTS: LinkVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']
const UNDERLINES: LinkUnderline[] = ['always', 'hover', 'none']

const _externalSvg = (LucideIcons as Record<string, string>)['ExternalLink'] ?? ''
const externalLinkIcon = _externalSvg ? icon(_externalSvg, 'tc-link__external-icon') : ''

export class Link extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'underline', 'external', 'href']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-link-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-link-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-link-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get variant(): LinkVariant {
        const v = this.getAttribute('variant') as LinkVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: LinkVariant) {
        this.setAttribute('variant', v)
    }

    get underline(): LinkUnderline {
        const v = this.getAttribute('underline') as LinkUnderline
        return UNDERLINES.includes(v) ? v : 'hover'
    }
    set underline(v: LinkUnderline) {
        this.setAttribute('underline', v)
    }

    get external(): boolean {
        return this.hasAttribute('external')
    }
    set external(v: boolean) {
        if (v) this.setAttribute('external', '')
        else this.removeAttribute('external')
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    private render(): void {
        const variant = this.variant
        const underline = this.underline
        const external = this.external
        const href = this.href ?? '#'

        const classes = `tc-link tc-link-${variant} tc-link-underline-${underline}`
        const externalAttrs = external ? ` target="_blank" rel="noopener noreferrer"` : ''
        const externalHtml = external
            ? `${externalLinkIcon}<span class="visually-hidden">(opens in new tab)</span>`
            : ''

        this.innerHTML = `<a href="${esc(href)}" class="${classes}"${externalAttrs}><span class="tc-link-content"></span>${externalHtml}</a>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Link
    }
}
