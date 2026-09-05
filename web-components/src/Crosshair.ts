import { patchHtml } from './internal/patch-html'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-crosshair'

export type CrosshairVariant = 'cross' | 'dot' | 'circle' | 'tShape' | 'classic' | 'rune'
const VARIANTS: CrosshairVariant[] = ['cross', 'dot', 'circle', 'tShape', 'classic', 'rune']

export class Crosshair extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'thickness', 'gap', 'color', 'spread']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        // Purely presentational reticle — keep it out of the accessibility tree
        // and non-interactive (it is a decorative aiming marker, not a control).
        this.setAttribute('aria-hidden', 'true')
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): CrosshairVariant {
        const raw = (this.getAttribute('variant') ?? 'cross') as CrosshairVariant
        return VARIANTS.includes(raw) ? raw : 'cross'
    }
    set variant(v: CrosshairVariant) {
        setAttr(this, 'variant', v)
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 24
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 24 : parsed
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    get thickness(): number {
        const raw = this.getAttribute('thickness')
        if (raw == null) return 2
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 2 : parsed
    }
    set thickness(v: number) {
        this.setAttribute('thickness', String(v))
    }

    get gap(): number {
        const raw = this.getAttribute('gap')
        if (raw == null) return 4
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 4 : parsed
    }
    set gap(v: number) {
        this.setAttribute('gap', String(v))
    }

    get color(): string {
        return this.getAttribute('color') ?? 'var(--tc-app-accent)'
    }
    set color(v: string) {
        setAttr(this, 'color', v)
    }

    get spread(): number {
        const raw = this.getAttribute('spread')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    }
    set spread(v: number) {
        this.setAttribute('spread', String(v))
    }

    private render(): void {
        const size = this.size
        const thickness = this.thickness
        const gap = this.gap + this.spread
        const variant = this.variant

        this.style.setProperty('--bs-crosshair-size', `${size}px`)
        this.style.setProperty('--bs-crosshair-thickness', `${thickness}px`)
        this.style.setProperty('--bs-crosshair-gap', `${gap}px`)

        // Default color lives on the tag selector in the SCSS partial; only the
        // explicit `color` attribute writes an inline override (wins on cascade).
        const color = this.getAttribute('color')
        if (color) this.style.setProperty('--bs-crosshair-color', color)
        else this.style.removeProperty('--bs-crosshair-color')

        this.dataset.variant = variant

        const armLen = (size - gap * 2) / 2

        const cross = `
            <span class="tc-crosshair-arm tc-crosshair-arm--top" style="height: ${armLen}px"></span>
            <span class="tc-crosshair-arm tc-crosshair-arm--bottom" style="height: ${armLen}px"></span>
            <span class="tc-crosshair-arm tc-crosshair-arm--left" style="width: ${armLen}px"></span>
            <span class="tc-crosshair-arm tc-crosshair-arm--right" style="width: ${armLen}px"></span>
        `

        let inner = ''
        switch (variant) {
            case 'cross':
                inner = cross
                break
            case 'dot':
                inner = `<span class="tc-crosshair-dot"></span>`
                break
            case 'circle':
                inner = `<span class="tc-crosshair-ring"></span><span class="tc-crosshair-dot"></span>`
                break
            case 'tShape':
                inner = `
                    <span class="tc-crosshair-arm tc-crosshair-arm--bottom" style="height: ${armLen}px"></span>
                    <span class="tc-crosshair-arm tc-crosshair-arm--left" style="width: ${armLen}px"></span>
                    <span class="tc-crosshair-arm tc-crosshair-arm--right" style="width: ${armLen}px"></span>
                `
                break
            case 'classic':
                inner = cross + `<span class="tc-crosshair-dot"></span>`
                break
            case 'rune':
                // Reworked from the game-components fantasy 8-point star into the
                // toolcase idiom: a sharp rotated-square marker framed by the ring.
                inner = `<span class="tc-crosshair-diamond"></span><span class="tc-crosshair-ring"></span>`
                break
        }

        patchHtml(this, inner)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Crosshair
    }
}
