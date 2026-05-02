const TAG_NAME = 'gc-icon-badge'

export class IconBadge extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['glyph', 'size', 'color', 'bg']
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

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get bg(): string {
        return this.getAttribute('bg') || ''
    }
    set bg(value: string) {
        if (value) this.setAttribute('bg', value)
        else this.removeAttribute('bg')
    }

    private render(): void {
        const size = this.size
        if (size != null) {
            this.style.setProperty('--gc-icon-badge-size', `${size}px`)
            this.style.setProperty('--gc-icon-badge-glyph-size', `${Math.round(size * 0.5)}px`)
        } else {
            this.style.removeProperty('--gc-icon-badge-size')
            this.style.removeProperty('--gc-icon-badge-glyph-size')
        }

        const color = this.color
        if (color) this.style.setProperty('--gc-icon-badge-color', color)
        else this.style.removeProperty('--gc-icon-badge-color')

        const bg = this.bg
        if (bg) this.style.setProperty('--gc-icon-badge-bg', bg)
        else this.style.removeProperty('--gc-icon-badge-bg')

        const glyph = this.glyph
        if (glyph.startsWith('bi-') || glyph.startsWith('bi ')) {
            const cls = glyph.startsWith('bi ') ? glyph : `bi ${glyph}`
            this.innerHTML = `<i class="gc-icon-badge-glyph ${this.escape(cls)}"></i>`
        } else {
            this.innerHTML = `<span class="gc-icon-badge-glyph">${this.escape(glyph)}</span>`
        }
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
    customElements.define(TAG_NAME, IconBadge)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: IconBadge
    }
}
