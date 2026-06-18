const TAG_NAME = 'tc-rune-corner'

export type RuneCornerPosition = 'tl' | 'tr' | 'bl' | 'br'
const POSITIONS: RuneCornerPosition[] = ['tl', 'tr', 'bl', 'br']

export class RuneCorner extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['at', 'size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.classList.add('tc-rune-corner')
            if (!this.hasAttribute('at')) {
                this.setAttribute('at', 'tl')
            }
            this._initialised = true
        }
        this._applyTokens()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._applyTokens()
    }

    get at(): RuneCornerPosition {
        const v = this.getAttribute('at') as RuneCornerPosition
        return POSITIONS.includes(v) ? v : 'tl'
    }
    set at(value: RuneCornerPosition) {
        this.setAttribute('at', POSITIONS.includes(value) ? value : 'tl')
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw === null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value === null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    private _applyTokens(): void {
        const raw = this.getAttribute('size')
        if (raw !== null) {
            const parsed = parseFloat(raw)
            if (!Number.isNaN(parsed)) {
                this.style.setProperty('--bs-rune-corner-size', `${parsed}px`)
            }
        } else {
            this.style.removeProperty('--bs-rune-corner-size')
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: RuneCorner
    }
}
