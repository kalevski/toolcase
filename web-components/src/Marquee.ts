import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-marquee'

export type MarqueeDirection = 'left' | 'right'

const DIRECTIONS: MarqueeDirection[] = ['left', 'right']
const DEFAULT_SPEED = 60

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export class Marquee extends HTMLElement {
    private _initialised = false
    private _items: string[] = []
    private _resizeObserver: ResizeObserver | null = null

    static get observedAttributes(): string[] {
        return ['separator', 'speed', 'direction', 'pause-on-hover']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._initialised = true
            this.render()
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._updateDuration()
    }

    get items(): string[] {
        return this._items
    }
    set items(v: string[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._updateDuration()
        }
    }

    get separator(): string {
        return this.getAttribute('separator') ?? ''
    }
    set separator(v: string) {
        if (v) this.setAttribute('separator', v)
        else this.removeAttribute('separator')
    }

    get speed(): number {
        const v = parseFloat(this.getAttribute('speed') ?? '')
        return isFinite(v) && v > 0 ? v : DEFAULT_SPEED
    }
    set speed(v: number) {
        this.setAttribute('speed', String(v))
    }

    get direction(): MarqueeDirection {
        const v = this.getAttribute('direction') as MarqueeDirection
        return DIRECTIONS.includes(v) ? v : 'left'
    }
    set direction(v: MarqueeDirection) {
        setAttr(this, 'direction', v)
    }

    get pauseOnHover(): boolean {
        return this.hasAttribute('pause-on-hover')
    }
    set pauseOnHover(v: boolean) {
        if (v) this.setAttribute('pause-on-hover', '')
        else this.removeAttribute('pause-on-hover')
    }

    private _attachHandlers(): void {
        this._resizeObserver?.disconnect()
        this._resizeObserver = new ResizeObserver(() => this._updateDuration())
        this._resizeObserver.observe(this)
        this._updateDuration()
    }

    private _detachHandlers(): void {
        this._resizeObserver?.disconnect()
        this._resizeObserver = null
    }

    private _updateDuration(): void {
        // Width of a single copy — measured off the always-present second copy
        // rather than `.tc-marquee-copy-1`, which only exists when the `items`
        // property is used: with slotted children the first copy is left as the
        // consumer's own unwrapped nodes (rule 1), so it has no single element to
        // measure. The second copy is always a faithful clone of the first
        // (whichever source it came from), so its rendered width is the correct
        // one-copy travel distance in both cases; the host's own offsetWidth would
        // just be the clipped viewport width (host is `overflow: hidden`), not the
        // content width.
        const copy2 = this.querySelector<HTMLElement>('.tc-marquee-copy-2')
        const w = (copy2 ?? this).offsetWidth
        const duration = w > 0 && this.speed > 0 ? w / this.speed : 10
        this.style.setProperty('--bs-marquee-duration', `${duration}s`)
        this.style.setProperty('--bs-marquee-distance', `${w}px`)
        this.style.setProperty(
            '--bs-marquee-direction-value',
            this.direction === 'right' ? 'reverse' : 'normal',
        )
    }

    private render(): void {
        const hasItems = this._items.length > 0
        const separator = this.separator
        // Passed straight to setAttribute below, which takes a literal value and
        // never parses entities — HTML-escaping it here would corrupt the
        // accessible name into literal "&amp;"-style text instead of preventing
        // any injection (setAttribute can't be injected into).
        const ariaLabel = this.getAttribute('aria-label') || 'Scrolling content'

        let copy1Html = ''
        let copy2Html = ''

        if (hasItems) {
            copy1Html = this._buildItemsHtml(this._items, separator, false)
            copy2Html = this._buildItemsHtml(this._items, separator, true)
        }

        // THE HOST IS THE MARQUEE. The first copy is whatever the consumer wrote —
        // left exactly where they wrote it (rule 1) — and the seamless second copy
        // is a CLONE of it, which is the element's own node to create and discard.
        setHostClass(this, 'tc-marquee')
        this.setAttribute('role', 'region')
        this.setAttribute('aria-label', ariaLabel)
        patchHtml(this, hasItems ? `<span class="tc-marquee-copy-1">${copy1Html}</span>` : '', {
            region: 'copy1',
        })
        patchHtml(this, `<span class="tc-marquee-copy-2" aria-hidden="true">${copy2Html}</span>`, {
            region: 'copy2',
            at: 'end',
        })
        if (!hasItems) this._mirrorSlottedContent()
    }

    /** Fill the second copy with clones of the consumer's own children. Cloning is
     *  the point: the originals stay put, and only nodes this element created are
     *  ever inserted or removed. */
    private _mirrorSlottedContent(): void {
        const copy2 = this.querySelector<HTMLElement>(':scope > .tc-marquee-copy-2')
        if (!copy2) return
        copy2.replaceChildren()
        // querySelectorAll of the consumer's own children, cloned — the originals
        // are read, never captured and re-homed (rule 1).
        const sources = this.querySelectorAll(
            ':scope > *:not(.tc-marquee-copy-1):not(.tc-marquee-copy-2)',
        )
        for (const child of sources) copy2.appendChild(child.cloneNode(true))
    }

    private _buildItemsHtml(items: string[], separator: string, ariaHidden: boolean): string {
        const hiddenAttr = ariaHidden ? ' aria-hidden="true"' : ''
        let html = ''
        for (let i = 0; i < items.length; i++) {
            if (i > 0 && separator) {
                html += `<span class="tc-marquee-sep" aria-hidden="true">${escHtml(separator)}</span>`
            }
            html += `<span class="tc-marquee-item"${hiddenAttr}>${escHtml(items[i])}</span>`
        }
        // Trailing separator for seamless visual junction between copies
        if (separator && items.length > 0) {
            html += `<span class="tc-marquee-sep tc-marquee-sep--junction" aria-hidden="true">${escHtml(separator)}</span>`
        }
        return html
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Marquee
    }
}
