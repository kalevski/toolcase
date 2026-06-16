const TAG_NAME = 'tc-gamepad-button-prompt'

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Port of game-components `gc-gamepad-button-prompt`. Purely attribute-driven,
// no slot content — the host element IS the rendered visual (see Avatar). The
// fantasy chrome is dropped: this renders a sharp slate key-cap holding the
// glyph (mono) with an optional caption label, all driven by --bs-gamepad-button-prompt-*.
export class GamepadButtonPrompt extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['glyph', 'label', 'size']
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
            this.style.setProperty('--bs-gamepad-button-prompt-size', `${size}px`)
            this.style.setProperty('--bs-gamepad-button-prompt-glyph-size', `${Math.round(size * 0.5)}px`)
        } else {
            this.style.removeProperty('--bs-gamepad-button-prompt-size')
            this.style.removeProperty('--bs-gamepad-button-prompt-glyph-size')
        }

        // data-button mirrors the source — a normalised theming hook (e.g. [data-button="A"]).
        const key = this.glyph.trim().toUpperCase()
        if (key) this.setAttribute('data-button', key)
        else this.removeAttribute('data-button')

        const labelText = this.label
        const labelHtml = labelText
            ? `<span class="tc-gamepad-button-prompt__label">${esc(labelText)}</span>`
            : ''
        this.innerHTML =
            `<span class="tc-gamepad-button-prompt">` +
            `<span class="tc-gamepad-button-prompt__glyph">${esc(this.glyph)}</span>` +
            labelHtml +
            `</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GamepadButtonPrompt
    }
}
