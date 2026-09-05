import { patchHtml } from './internal/patch-html'
import { consumerText, observeContent } from './internal/content-observer'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

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
        this._initialised = true
        this.render()
        // The accessible name is a copy of the consumer's label text, so it has to
        // follow that text when React rewrites it — see content-observer.ts.
        observeContent(this, () => this.render())
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): LinkVariant {
        const v = this.getAttribute('variant') as LinkVariant
        return VARIANTS.includes(v) ? v : 'primary'
    }
    set variant(v: LinkVariant) {
        setAttr(this, 'variant', v)
    }

    get underline(): LinkUnderline {
        const v = this.getAttribute('underline') as LinkUnderline
        return UNDERLINES.includes(v) ? v : 'hover'
    }
    set underline(v: LinkUnderline) {
        setAttr(this, 'underline', v)
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

        // THE HOST IS THE LINK BOX. The real <a> is kept — middle-click, "copy link
        // address" and keyboard focus all still work — but it covers the host as a
        // stretched hit area instead of wrapping the consumer's children (rule 1).
        // Its accessible name is taken from the content it covers.
        setHostClass(this, classes)
        const label = consumerText(this)
        const nameAttr = label ? ` aria-label="${esc(label)}"` : ''
        patchHtml(
            this,
            `<a href="${esc(href)}" class="tc-link-hit"${externalAttrs}${nameAttr}></a>`,
            { region: 'hit' },
        )
        patchHtml(this, externalHtml, { region: 'external', at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Link
    }
}
