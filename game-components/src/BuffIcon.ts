const TAG_NAME = 'gc-buff-icon'

export type BuffKind = 'buff' | 'debuff'

export class BuffIcon extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['glyph', 'time', 'kind', 'color', 'size']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get glyph(): string {
        return this.getAttribute('glyph') ?? ''
    }
    set glyph(v: string) {
        this.setAttribute('glyph', v)
    }

    get time(): string {
        return this.getAttribute('time') ?? ''
    }
    set time(v: string) {
        this.setAttribute('time', v)
    }

    get kind(): BuffKind {
        const raw = this.getAttribute('kind')
        return raw === 'debuff' ? 'debuff' : 'buff'
    }
    set kind(v: BuffKind) {
        this.setAttribute('kind', v)
    }

    get color(): string {
        return this.getAttribute('color') ?? ''
    }
    set color(v: string) {
        this.setAttribute('color', v)
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 36
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 36 : parsed
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--gc-buff-icon-size', `${size}px`)
        this.dataset.kind = this.kind

        const glyph = this.glyph
        const time = this.time
        const color = this.color

        const isIcon = glyph.startsWith('bi ') || glyph.startsWith('bi-')
        const glyphMarkup = isIcon
            ? `<i class="${this.escape(glyph)}"></i>`
            : `<span>${this.escape(glyph)}</span>`

        const colorStyle = color ? ` style="color: ${this.escape(color)}"` : ''

        this.innerHTML = `
            <div class="gc-buff-icon-glyph"${colorStyle}>${glyphMarkup}</div>
            ${time ? `<span class="gc-buff-icon-time">${this.escape(time)}</span>` : ''}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, BuffIcon)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BuffIcon
    }
}
