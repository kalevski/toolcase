const TAG_NAME = 'gc-portrait'

export class Portrait extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['glyph', 'size', 'ring', 'level', 'circle']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get glyph(): string {
        return this.getAttribute('glyph') || ''
    }
    set glyph(value: string) {
        if (value) this.setAttribute('glyph', value)
        else this.removeAttribute('glyph')
    }

    get size(): number | null {
        const value = this.getAttribute('size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    get ring(): string {
        return this.getAttribute('ring') || ''
    }
    set ring(value: string) {
        if (value) this.setAttribute('ring', value)
        else this.removeAttribute('ring')
    }

    get level(): number | null {
        const value = this.getAttribute('level')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set level(value: number | null) {
        if (value == null) this.removeAttribute('level')
        else this.setAttribute('level', String(value))
    }

    get circle(): boolean {
        return this.hasAttribute('circle')
    }
    set circle(value: boolean) {
        if (value) this.setAttribute('circle', '')
        else this.removeAttribute('circle')
    }

    private render(): void {
        const size = this.size
        if (size != null) {
            this.style.setProperty('--gc-portrait-size', `${size}px`)
            this.style.setProperty('--gc-portrait-glyph-size', `${Math.round(size * 0.45)}px`)
        } else {
            this.style.removeProperty('--gc-portrait-size')
            this.style.removeProperty('--gc-portrait-glyph-size')
        }

        const ring = this.ring
        if (ring) this.style.setProperty('--gc-portrait-ring', ring)
        else this.style.removeProperty('--gc-portrait-ring')

        const level = this.level
        const glyphHtml = `<span class="gc-portrait-glyph">${this.escape(this.glyph)}</span>`
        const levelHtml = level != null
            ? `<span class="gc-portrait-level">${this.escape(String(level))}</span>`
            : ''
        this.innerHTML = `${glyphHtml}${levelHtml}`
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Portrait)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Portrait
    }
}
