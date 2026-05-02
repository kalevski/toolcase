const TAG_NAME = 'gc-title'

export class Title extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['size']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.applySize()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.applySize()
        }
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

    private applySize(): void {
        const value = this.size
        if (value != null) {
            this.style.setProperty('--gc-title-size', `${value}px`)
        } else {
            this.style.removeProperty('--gc-title-size')
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Title)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Title
    }
}
