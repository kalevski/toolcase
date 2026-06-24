import { esc } from './internal/esc'
const TAG_NAME = 'tc-portrait'

function looksLikeUrl(s: string): boolean {
    return /^https?:\/\//.test(s) || /^\//.test(s) || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(s)
}

export class Portrait extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['glyph', 'size', 'ring', 'level', 'circle']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get glyph(): string {
        return this.getAttribute('glyph') ?? ''
    }
    set glyph(v: string) {
        if (v) this.setAttribute('glyph', v)
        else this.removeAttribute('glyph')
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw === null) return null
        const n = parseFloat(raw)
        return Number.isNaN(n) ? null : n
    }
    set size(v: number | null) {
        if (v === null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get ring(): string {
        return this.getAttribute('ring') ?? ''
    }
    set ring(v: string) {
        if (v) this.setAttribute('ring', v)
        else this.removeAttribute('ring')
    }

    get level(): number | null {
        const raw = this.getAttribute('level')
        if (raw === null) return null
        const n = parseFloat(raw)
        return Number.isNaN(n) ? null : n
    }
    set level(v: number | null) {
        if (v === null) this.removeAttribute('level')
        else this.setAttribute('level', String(v))
    }

    get circle(): boolean {
        return this.hasAttribute('circle')
    }
    set circle(v: boolean) {
        if (v) this.setAttribute('circle', '')
        else this.removeAttribute('circle')
    }

    private render(): void {
        const size = this.size
        const ring = this.ring
        const level = this.level
        const glyph = this.glyph
        const isCircle = this.circle

        if (size !== null) {
            this.style.setProperty('--bs-portrait-size', `${size}px`)
        } else {
            this.style.removeProperty('--bs-portrait-size')
        }

        if (ring) {
            this.style.setProperty('--bs-portrait-ring-color', ring)
        } else {
            this.style.removeProperty('--bs-portrait-ring-color')
        }

        // No slot — host IS the visual; className = is safe here.
        this.className = `tc-portrait${isCircle ? ' tc-portrait--circle' : ''}`
        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', glyph || 'Portrait')

        let bodyContent: string
        if (glyph && looksLikeUrl(glyph)) {
            bodyContent = `<img class="tc-portrait__img" src="${esc(glyph)}" alt="" aria-hidden="true">`
        } else {
            bodyContent = `<span class="tc-portrait__glyph" aria-hidden="true">${esc(glyph)}</span>`
        }

        const levelHtml =
            level !== null
                ? `<span class="tc-portrait__level">${esc(String(Math.floor(level)))}</span>`
                : ''

        this.innerHTML = bodyContent + levelHtml
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Portrait
    }
}
