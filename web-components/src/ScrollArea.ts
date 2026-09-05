import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-scroll-area'

export type ScrollAreaAxis = 'x' | 'y' | 'both'

const AXES: ScrollAreaAxis[] = ['x', 'y', 'both']

// Bare integers (author writes max-height="240" meaning 240px) resolve to px;
// full CSS length strings ("60vh", "100%", "20rem") pass through unchanged.
function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    const v = raw.trim()
    if (v === '') return null
    return /^\d+(\.\d+)?$/.test(v) ? `${v}px` : v
}

export class ScrollArea extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['max-height', 'max-width', 'axis']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
            this._syncScrollability()
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
        this._syncScrollability()
    }

    // The scroll container is keyboard-scrollable only when its content actually
    // overflows — an empty focus stop on a non-scrolling region is noise. Measure
    // after children are (re)appended and toggle tabindex accordingly.
    private _syncScrollability(): void {
        const overflows =
            this.scrollHeight > this.clientHeight || this.scrollWidth > this.clientWidth
        if (overflows) this.setAttribute('tabindex', '0')
        else this.removeAttribute('tabindex')
    }

    get maxHeight(): string | null {
        return this.getAttribute('max-height')
    }
    set maxHeight(v: string | number | null) {
        if (v != null) this.setAttribute('max-height', String(v))
        else this.removeAttribute('max-height')
    }

    get maxWidth(): string | null {
        return this.getAttribute('max-width')
    }
    set maxWidth(v: string | number | null) {
        if (v != null) this.setAttribute('max-width', String(v))
        else this.removeAttribute('max-width')
    }

    get axis(): ScrollAreaAxis {
        const v = this.getAttribute('axis') as ScrollAreaAxis
        return AXES.includes(v) ? v : 'y'
    }
    set axis(v: ScrollAreaAxis) {
        setAttr(this, 'axis', v)
    }

    private render(): void {
        const axis = this.axis
        const maxHeight = resolveLength(this.maxHeight)
        const maxWidth = resolveLength(this.maxWidth)

        const overflowX = axis === 'x' || axis === 'both' ? 'auto' : 'hidden'
        const overflowY = axis === 'y' || axis === 'both' ? 'auto' : 'hidden'

        const styles: string[] = [`overflow-x:${overflowX}`, `overflow-y:${overflowY}`]
        if (maxHeight) styles.push(`max-height:${maxHeight}`)
        if (maxWidth) styles.push(`max-width:${maxWidth}`)

        // THE HOST IS THE SCROLLER: the content it scrolls is the consumer's own
        // children, still direct children of their tag (rule 1).
        setHostClass(this, `tc-scroll-area tc-scroll-area--axis-${axis}`)
        this.style.overflowX = overflowX
        this.style.overflowY = overflowY
        this.style.maxHeight = maxHeight ?? ''
        this.style.maxWidth = maxWidth ?? ''
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScrollArea
    }
}
