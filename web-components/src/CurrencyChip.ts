import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-currency-chip'

// Port of game-components `gc-currency-chip`: a compact currency pill pairing a
// leading glyph (currency symbol or short icon string) with a formatted amount.
// Purely attribute-driven, no slots, no events. The fantasy chrome (gilded frame,
// metal fill) is dropped — this renders as a sharp slate chip per the design system.
export class CurrencyChip extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['glyph', 'amount', 'color']
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
        if (color) this.style.setProperty('--bs-currency-chip-color', color)
        else this.style.removeProperty('--bs-currency-chip-color')

        const glyph = this.glyph
        const glyphHtml = glyph
            ? `<span class="tc-currency-chip-glyph" aria-hidden="true">${esc(glyph)}</span>`
            : ''
        const amount = esc(this.amount.toLocaleString())

        patchHtml(
            this,
            `<span class="tc-currency-chip">${glyphHtml}<span class="tc-currency-chip-amount">${amount}</span></span>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CurrencyChip
    }
}
