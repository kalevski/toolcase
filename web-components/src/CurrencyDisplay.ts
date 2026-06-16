const TAG_NAME = 'tc-currency-display'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Port of game-components `gc-currency-display`: a larger currency readout pairing
// an optional label and currency icon with a prominent formatted amount. Purely
// attribute-driven, no slots, no events. The fantasy chrome (gilded frame, glow,
// metal fill) is dropped — this renders as a sharp slate readout per the design
// system: a uppercase mono micro-label above an ink-accented icon and a JetBrains
// Mono amount with tabular figures.
//
// The `color` attribute writes --bs-currency-display-color (the icon tint) on the
// host; the `font-size` attribute writes --bs-currency-display-amount-font-size (in
// px) so the prominent amount can be scaled per-instance.
export class CurrencyDisplay extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['amount', 'currency-icon', 'label', 'color', 'font-size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (color) this.style.setProperty('--bs-currency-display-color', color)
        else this.style.removeProperty('--bs-currency-display-color')

        const fs = this.fontSize
        if (fs != null) this.style.setProperty('--bs-currency-display-amount-font-size', `${fs}px`)
        else this.style.removeProperty('--bs-currency-display-amount-font-size')

        const labelText = this.label
        const labelHtml = labelText
            ? `<span class="tc-currency-display-label">${esc(labelText)}</span>`
            : ''

        const iconText = this.currencyIcon
        const iconHtml = iconText
            ? `<span class="tc-currency-display-icon" aria-hidden="true">${esc(iconText)}</span>`
            : ''

        const amountHtml = `<span class="tc-currency-display-amount">${esc(this.amount.toLocaleString())}</span>`

        this.innerHTML = [
            '<span class="tc-currency-display">',
            labelHtml,
            '<span class="tc-currency-display-readout">',
            iconHtml,
            amountHtml,
            '</span>',
            '</span>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CurrencyDisplay
    }
}
