const TAG_NAME = 'gc-aspect-ratio-box'

export class AspectRatioBox extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['ratio']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
    }

    connectedCallback(): void {
        if (!this.root.firstChild) {
            this.root.innerHTML = `<div class="gc-aspect-ratio-box-content"><slot></slot></div>`
        }
        this.applyRatio()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.applyRatio()
    }

    get ratio(): string {
        return this.getAttribute('ratio') ?? '16 / 9'
    }
    set ratio(value: string) {
        if (value) this.setAttribute('ratio', value)
        else this.removeAttribute('ratio')
    }

    private applyRatio(): void {
        const r = this.ratio
        this.style.setProperty('--gc-aspect-ratio', r)
        const parts = r.split(/[\/:]/).map((s) => parseFloat(s.trim()))
        if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            const pct = (parts[1] / parts[0]) * 100
            this.style.setProperty('--gc-aspect-ratio-fallback', `${pct.toFixed(4)}%`)
        } else {
            this.style.removeProperty('--gc-aspect-ratio-fallback')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AspectRatioBox
    }
}
