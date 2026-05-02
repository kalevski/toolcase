const TAG_NAME = 'gc-currency-display'

export class CurrencyDisplay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['amount', 'currency-icon', 'label', 'color', 'font-size']
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

    get amount(): number {
        const raw = this.getAttribute('amount')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set amount(value: number) {
        this.setAttribute('amount', String(value))
    }

    get currencyIcon(): string {
        return this.getAttribute('currency-icon') || ''
    }
    set currencyIcon(value: string) {
        if (value) this.setAttribute('currency-icon', value)
        else this.removeAttribute('currency-icon')
    }

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get color(): string {
        return this.getAttribute('color') || ''
    }
    set color(value: string) {
        if (value) this.setAttribute('color', value)
        else this.removeAttribute('color')
    }

    get fontSize(): number | null {
        const value = this.getAttribute('font-size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set fontSize(value: number | null) {
        if (value == null) this.removeAttribute('font-size')
        else this.setAttribute('font-size', String(value))
    }

    private render(): void {
        const color = this.color
        if (color) this.style.setProperty('--gc-currency-display-color', color)
        else this.style.removeProperty('--gc-currency-display-color')

        const fs = this.fontSize
        if (fs != null) this.style.setProperty('--gc-currency-display-font-size', `${fs}px`)
        else this.style.removeProperty('--gc-currency-display-font-size')

        const labelText = this.label
        const labelHtml = labelText
            ? `<span class="gc-currency-display-label">${this.escape(labelText)}</span>`
            : ''
        const iconText = this.currencyIcon
        const iconHtml = iconText
            ? `<span class="gc-currency-display-icon">${this.escape(iconText)}</span>`
            : ''
        const amountHtml = `<span class="gc-currency-display-amount">${this.escape(this.amount.toLocaleString())}</span>`
        this.innerHTML = `${labelHtml}${iconHtml}${amountHtml}`
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
        [TAG_NAME]: CurrencyDisplay
    }
}
