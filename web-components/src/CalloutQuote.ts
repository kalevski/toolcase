import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-callout-quote'

const quoteMarkIcon = icon((LucideIcons as Record<string, string>)['Quote'] ?? '')

export class CalloutQuote extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['quote', 'attribution', 'source', 'source-href']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get quote(): string | null {
        return this.getAttribute('quote')
    }
    set quote(v: string | null) {
        if (v != null) this.setAttribute('quote', v)
        else this.removeAttribute('quote')
    }

    get attribution(): string | null {
        return this.getAttribute('attribution')
    }
    set attribution(v: string | null) {
        if (v != null) this.setAttribute('attribution', v)
        else this.removeAttribute('attribution')
    }

    get source(): string | null {
        return this.getAttribute('source')
    }
    set source(v: string | null) {
        if (v != null) this.setAttribute('source', v)
        else this.removeAttribute('source')
    }

    get sourceHref(): string | null {
        return this.getAttribute('source-href')
    }
    set sourceHref(v: string | null) {
        if (v != null) this.setAttribute('source-href', v)
        else this.removeAttribute('source-href')
    }

    private render(): void {
        const quote = this.getAttribute('quote')
        const attribution = this.getAttribute('attribution')
        const source = this.getAttribute('source')
        const sourceHref = this.getAttribute('source-href')

        let captionHtml = ''
        if (attribution || source) {
            const authorHtml = attribution
                ? `<cite class="tc-callout-quote__author">${esc(attribution)}</cite>`
                : ''
            let sourceHtml = ''
            if (source) {
                if (sourceHref) {
                    sourceHtml = `<a href="${esc(sourceHref)}" target="_blank" rel="noopener noreferrer" class="tc-callout-quote__source">${esc(source)}</a>`
                } else {
                    sourceHtml = `<span class="tc-callout-quote__source">${esc(source)}</span>`
                }
            }
            captionHtml = `<figcaption class="tc-callout-quote__caption">${authorHtml}${sourceHtml}</figcaption>`
        }

        // THE HOST IS THE FIGURE: the mark and, when the attribute supplies one, the
        // quote text are element-owned and prepended; the caption is appended. A
        // slotted quote stays the consumer's own child between them (rule 1).
        setHostClass(this, 'tc-callout-quote')
        this.setAttribute('role', 'figure')
        patchHtml(
            this,
            `<span class="tc-callout-quote__mark" aria-hidden="true">${quoteMarkIcon}</span>` +
                (quote != null
                    ? `<blockquote class="tc-callout-quote__text">${esc(quote)}</blockquote>`
                    : ''),
            { region: 'lead' },
        )
        patchHtml(this, captionHtml, { region: 'caption', at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CalloutQuote
    }
}
