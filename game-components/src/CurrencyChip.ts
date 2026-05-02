const TAG_NAME = 'gc-currency-chip'

export class CurrencyChip extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['glyph', 'amount', 'color']
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

    get glyph(): string {
        return this.getAttribute('glyph') || ''
    }
    set glyph(value: string) {
        if (value) this.setAttribute('glyph', value)
        else this.removeAttribute('glyph')
    }

    get amount(): number {
        const raw = this.getAttribute('amount')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set amount(value: number) {
        this.setAttribute('amount', String(value))
    }

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    private render(): void {
        const color = this.color
        if (color) this.style.setProperty('--gc-currency-chip-color', color)
        else this.style.removeProperty('--gc-currency-chip-color')

        const glyph = this.escape(this.glyph)
        const amount = this.escape(this.amount.toLocaleString())
        this.innerHTML = `<span class="gc-currency-chip-glyph">${glyph}</span><span class="gc-currency-chip-amount">${amount}</span>`
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CurrencyChip
    }
}
