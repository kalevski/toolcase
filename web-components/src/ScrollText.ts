import { esc } from './internal/esc'
import { setHostClass } from './internal/host-class'
import { syncOwnedNodes } from './internal/tc-element'
const TAG_NAME = 'tc-scroll-text'

function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    return /^\d+(\.\d+)?$/.test(raw.trim()) ? `${raw.trim()}px` : raw
}

export class ScrollText extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['scroll-title', 'max-height']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
        this._syncScrollability()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._syncScrollability()
    }

    // Keyboard-scrollable only when the content actually overflows — an empty
    // focus stop on a non-scrolling panel is noise. Mirrors tc-scroll-area's
    // _syncScrollability so this sibling "host-is-the-scroller" component gets
    // the same keyboard/focus-visible affordance.
    private _syncScrollability(): void {
        const overflows = this.scrollHeight > this.clientHeight
        if (overflows) this.setAttribute('tabindex', '0')
        else this.removeAttribute('tabindex')
    }

    get scrollTitle(): string {
        return this.getAttribute('scroll-title') ?? ''
    }
    set scrollTitle(v: string) {
        if (v) this.setAttribute('scroll-title', v)
        else this.removeAttribute('scroll-title')
    }

    get maxHeight(): string | null {
        return this.getAttribute('max-height')
    }
    set maxHeight(v: string | null) {
        if (v != null) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
    }

    /** THE HOST IS THE SCROLL BOX: it carries `max-height` and `overflow-y`, and
     *  the header is a sticky owned node prepended above the consumer's own
     *  children — which are never moved into a body wrapper (rule 1). */
    private render(): void {
        setHostClass(this, 'tc-scroll-text')

        const maxH = resolveLength(this.getAttribute('max-height'))
        if (maxH !== null) {
            this.style.setProperty('--bs-scroll-text-max-height', maxH)
        } else {
            this.style.removeProperty('--bs-scroll-text-max-height')
        }

        const title = this.scrollTitle
        syncOwnedNodes(this, [{ cls: 'tc-scroll-text__header', html: title ? esc(title) : null }])
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScrollText
    }
}
