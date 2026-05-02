const TAG_NAME = 'gc-grid'

export class Grid extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['columns', 'rows', 'gap', 'cell-size']
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
        this.applyLayout()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.applyLayout()
        }
    }

    get columns(): string {
        return this.getAttribute('columns') ?? ''
    }
    set columns(value: string) {
        this.setAttribute('columns', value)
    }

    get rows(): string {
        return this.getAttribute('rows') ?? ''
    }
    set rows(value: string) {
        this.setAttribute('rows', value)
    }

    get gap(): string {
        return this.getAttribute('gap') ?? ''
    }
    set gap(value: string) {
        this.setAttribute('gap', value)
    }

    get cellSize(): string {
        return this.getAttribute('cell-size') ?? ''
    }
    set cellSize(value: string) {
        this.setAttribute('cell-size', value)
    }

    private applyLayout(): void {
        const size = this.cellSize || '1fr'
        this.style.display = 'grid'
        this.style.gridTemplateColumns = this.columns ? `repeat(${this.columns}, ${size})` : ''
        this.style.gridTemplateRows = this.rows ? `repeat(${this.rows}, ${size})` : ''
        this.style.gap = this.gap || '0px'
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Grid)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Grid
    }
}
