const TAG_NAME = 'gc-compass-rose'

export class CompassRose extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['heading', 'size']
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

    get heading(): number {
        const raw = this.getAttribute('heading')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set heading(value: number) {
        this.setAttribute('heading', String(value))
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

    private render(): void {
        const size = this.size
        if (size != null) {
            this.style.setProperty('--gc-compass-size', `${size}px`)
        } else {
            this.style.removeProperty('--gc-compass-size')
        }

        const heading = this.heading
        this.style.setProperty('--gc-compass-rotation', `${heading}deg`)

        this.innerHTML = `
            <svg class="gc-compass-rose-face" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="48" class="gc-compass-rose-ring" />
                <circle cx="50" cy="50" r="44" class="gc-compass-rose-bg" />
                <g class="gc-compass-rose-needle">
                    <polygon points="50,8 56,50 50,42 44,50" class="gc-compass-rose-needle-n" />
                    <polygon points="50,92 56,50 50,58 44,50" class="gc-compass-rose-needle-s" />
                </g>
                <text x="50" y="20" text-anchor="middle" class="gc-compass-rose-label">N</text>
                <text x="82" y="54" text-anchor="middle" class="gc-compass-rose-label">E</text>
                <text x="50" y="88" text-anchor="middle" class="gc-compass-rose-label">S</text>
                <text x="18" y="54" text-anchor="middle" class="gc-compass-rose-label">W</text>
            </svg>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CompassRose
    }
}
