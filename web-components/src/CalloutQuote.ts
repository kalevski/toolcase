import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-callout-quote'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

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
        if (!this._initialised) {
            const hasQuoteAttr = this.hasAttribute('quote')
            const slotContent = hasQuoteAttr ? [] : Array.from(this.childNodes)
            this.render()
            if (!hasQuoteAttr) {
                const inner = this.querySelector('.tc-callout-quote-content')
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const hasQuoteAttr = this.hasAttribute('quote')
        const inner = this.querySelector('.tc-callout-quote-content')
        const slotContent = (!hasQuoteAttr && inner) ? Array.from(inner.childNodes) : []
        this.render()
        if (!hasQuoteAttr) {
            const newInner = this.querySelector('.tc-callout-quote-content')
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        }
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

        const quoteBody = quote != null
            ? esc(quote)
            : `<span class="tc-callout-quote-content"></span>`

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

        this.innerHTML = `<figure class="tc-callout-quote"><span class="tc-callout-quote__mark" aria-hidden="true">${quoteMarkIcon}</span><blockquote class="tc-callout-quote__text">${quoteBody}</blockquote>${captionHtml}</figure>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CalloutQuote
    }
}
