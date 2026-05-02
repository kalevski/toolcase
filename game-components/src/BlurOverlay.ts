const TAG_NAME = 'gc-blur-overlay'

export class BlurOverlay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['blur-amount', 'background']
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

    get blurAmount(): string {
        return this.getAttribute('blur-amount') ?? '8px'
    }
    set blurAmount(v: string) {
        if (v) this.setAttribute('blur-amount', v)
        else this.removeAttribute('blur-amount')
    }

    get background(): string {
        return this.getAttribute('background') ?? 'rgba(0, 0, 0, 0.45)'
    }
    set background(v: string) {
        if (v) this.setAttribute('background', v)
        else this.removeAttribute('background')
    }

    private applyTokens(): void {
        this.style.setProperty('--gc-blur-amount', this.blurAmount)
        this.style.setProperty('--gc-blur-background', this.background)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BlurOverlay
    }
}
