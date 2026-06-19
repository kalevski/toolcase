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
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-scroll-area-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
            this._syncScrollability()
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-scroll-area-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-scroll-area-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        this._syncScrollability()
    }

    // The scroll container is keyboard-scrollable only when its content actually
    // overflows — an empty focus stop on a non-scrolling region is noise. Measure
    // after children are (re)appended and toggle tabindex accordingly.
    private _syncScrollability(): void {
        const area = this.querySelector<HTMLElement>('.tc-scroll-area')
        if (!area) return
        const overflows =
            area.scrollHeight > area.clientHeight || area.scrollWidth > area.clientWidth
        if (overflows) area.setAttribute('tabindex', '0')
        else area.removeAttribute('tabindex')
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
        this.setAttribute('axis', v)
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

        this.innerHTML = `<div class="tc-scroll-area tc-scroll-area--axis-${axis}" style="${styles.join(';')}"><div class="tc-scroll-area-content"></div></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScrollArea
    }
}
