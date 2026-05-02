const TAG_NAME = 'gc-vignette-overlay'

export class VignetteOverlay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['intensity', 'vignette-color']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        if (!this.root.firstChild) {
            this.root.innerHTML = `<slot></slot>`
        }
        this.applyTokens()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.applyTokens()
    }

    get intensity(): number {
        const v = parseFloat(this.getAttribute('intensity') ?? '0.6')
        return isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.6
    }
    set intensity(v: number) {
        this.setAttribute('intensity', String(v))
    }

    get vignetteColor(): string {
        return this.getAttribute('vignette-color') ?? '#000000'
    }
    set vignetteColor(v: string) {
        if (v) this.setAttribute('vignette-color', v)
        else this.removeAttribute('vignette-color')
    }

    private applyTokens(): void {
        this.style.setProperty('--gc-vignette-intensity', String(this.intensity))
        this.style.setProperty('--gc-vignette-color', this.vignetteColor)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VignetteOverlay
    }
}
