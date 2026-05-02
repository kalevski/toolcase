const TAG_NAME = 'gc-gamepad-button-prompt'

export class GamepadButtonPrompt extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['glyph', 'label', 'size']
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

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
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
            this.style.setProperty('--gc-gamepad-button-size', `${size}px`)
            this.style.setProperty('--gc-gamepad-button-glyph-size', `${Math.round(size * 0.6)}px`)
        } else {
            this.style.removeProperty('--gc-gamepad-button-size')
            this.style.removeProperty('--gc-gamepad-button-glyph-size')
        }

        const key = this.glyph.trim().toUpperCase()
        if (key) this.setAttribute('data-button', key)
        else this.removeAttribute('data-button')

        const labelText = this.label
        const labelHtml = labelText
            ? `<span class="gc-gamepad-button-label">${this.escape(labelText)}</span>`
            : ''
        this.innerHTML = `<span class="gc-gamepad-button-glyph">${this.escape(this.glyph)}</span>${labelHtml}`
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
        [TAG_NAME]: GamepadButtonPrompt
    }
}
