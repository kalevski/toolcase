const TAG_NAME = 'gc-rune-corner'

export type RuneCornerPosition = 'tl' | 'tr' | 'bl' | 'br'

export class RuneCorner extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['at', 'size']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('at')) {
            this.setAttribute('at', 'tl')
        }
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get at(): RuneCornerPosition {
        return (this.getAttribute('at') as RuneCornerPosition) || 'tl'
    }
    set at(value: RuneCornerPosition) {
        this.setAttribute('at', value)
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
            this.style.setProperty('--gc-rune-corner-size', `${size}px`)
        } else {
            this.style.removeProperty('--gc-rune-corner-size')
        }
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, RuneCorner)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RuneCorner
    }
}
