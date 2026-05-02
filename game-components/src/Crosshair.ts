const TAG_NAME = 'gc-crosshair'

export type CrosshairVariant = 'cross' | 'dot' | 'circle' | 'tShape' | 'classic' | 'rune'

export class Crosshair extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['variant', 'size', 'thickness', 'gap', 'color', 'spread']
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

    get variant(): CrosshairVariant {
        const raw = (this.getAttribute('variant') ?? 'cross') as CrosshairVariant
        const allowed: CrosshairVariant[] = ['cross', 'dot', 'circle', 'tShape', 'classic', 'rune']
        return allowed.includes(raw) ? raw : 'cross'
    }
    set variant(v: CrosshairVariant) {
        this.setAttribute('variant', v)
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
        return this.getAttribute('color') ?? 'var(--fg-parch)'
    }
    set color(v: string) {
        this.setAttribute('color', v)
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
        const color = this.color

        this.style.setProperty('--gc-crosshair-size', `${size}px`)
        this.style.setProperty('--gc-crosshair-thickness', `${thickness}px`)
        this.style.setProperty('--gc-crosshair-gap', `${gap}px`)
        this.style.setProperty('--gc-crosshair-color', color)
        this.dataset.variant = variant

        const armLen = (size - gap * 2) / 2

        const cross = `
            <div class="gc-crosshair-arm gc-crosshair-arm-top" style="height: ${armLen}px"></div>
            <div class="gc-crosshair-arm gc-crosshair-arm-bottom" style="height: ${armLen}px"></div>
            <div class="gc-crosshair-arm gc-crosshair-arm-left" style="width: ${armLen}px"></div>
            <div class="gc-crosshair-arm gc-crosshair-arm-right" style="width: ${armLen}px"></div>
        `

        let inner = ''
        switch (variant) {
            case 'cross':
                inner = cross
                break
            case 'dot':
                inner = `<div class="gc-crosshair-dot"></div>`
                break
            case 'circle':
                inner = `<div class="gc-crosshair-circle"></div><div class="gc-crosshair-dot"></div>`
                break
            case 'tShape':
                inner = `
                    <div class="gc-crosshair-arm gc-crosshair-arm-bottom" style="height: ${armLen}px"></div>
                    <div class="gc-crosshair-arm gc-crosshair-arm-left" style="width: ${armLen}px"></div>
                    <div class="gc-crosshair-arm gc-crosshair-arm-right" style="width: ${armLen}px"></div>
                `
                break
            case 'classic':
                inner = cross + `<div class="gc-crosshair-dot"></div>`
                break
            case 'rune':
                inner = `
                    <div class="gc-crosshair-rune"></div>
                    <div class="gc-crosshair-circle"></div>
                `
                break
        }

        this.innerHTML = inner
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Crosshair
    }
}
