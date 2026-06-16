const TAG_NAME = 'tc-grid'

// Bare integers (e.g. cell-size="48" or gap="8") are treated as px lengths;
// any other value (a fraction unit like "1fr", a keyword like "auto", or an
// explicit length like "1rem") is passed through untouched.
function resolveLength(raw: string | null): string {
    if (raw === null) return ''
    const trimmed = raw.trim()
    return /^\d+(\.\d+)?$/.test(trimmed) ? `${trimmed}px` : trimmed
}

export class Grid extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['columns', 'rows', 'gap', 'cell-size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // tc-grid is a pure layout primitive — it never owns its children's
            // markup, so there is no slot capture/re-append cycle (cf. Spacer).
            this.classList.add('tc-grid')
            this.applyLayout()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.applyLayout()
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

    // Cosmetics flow through --bs-grid-* custom properties (the public theming
    // contract); the SCSS partial declares the defaults and consumes them.
    private applyLayout(): void {
        const size = resolveLength(this.getAttribute('cell-size')) || '1fr'
        const columns = this.columns
        const rows = this.rows
        const gap = resolveLength(this.getAttribute('gap'))

        if (columns) this.style.setProperty('--bs-grid-template-columns', `repeat(${columns}, ${size})`)
        else this.style.removeProperty('--bs-grid-template-columns')

        if (rows) this.style.setProperty('--bs-grid-template-rows', `repeat(${rows}, ${size})`)
        else this.style.removeProperty('--bs-grid-template-rows')

        if (gap) this.style.setProperty('--bs-grid-gap', gap)
        else this.style.removeProperty('--bs-grid-gap')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Grid
    }
}
