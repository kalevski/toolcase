import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-deadzone-slider'

// tc-deadzone-slider — a stick-deadzone preset row. A native range input
// (0–1, 1% steps) paired with a mono percentage readout, built on the shared
// setting-row scaffold. Port of game-components `gc-deadzone-slider` with the
// fantasy chrome dropped for the toolcase slate/ink look.

export class DeadzoneSlider extends SettingRowBase {

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Stick deadzone')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch the value in place — a full re-render would destroy the input
        // (and the active drag) on every `input` event.
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('.tc-deadzone-slider__input')
            const display = this.querySelector<HTMLElement>('.tc-deadzone-slider__value')
            const v = this.value
            if (input && input.value !== String(v)) input.value = String(v)
            if (display) display.textContent = `${Math.round(v * 100)}%`
            return
        }
        super.attributeChangedCallback(name, old, next)
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0.15
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0.15 : Math.max(0, Math.min(1, parsed))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    protected renderControl(): string {
        const value = this.value
        const disabledAttr = this.disabled ? ' disabled' : ''
        return `
            <div class="tc-deadzone-slider__control">
                <input
                    type="range"
                    class="tc-deadzone-slider__input"
                    min="0"
                    max="1"
                    step="0.01"
                    value="${value}"
                    aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
                />
                <span class="tc-deadzone-slider__value">${Math.round(value * 100)}%</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector<HTMLInputElement>('.tc-deadzone-slider__input')
        const display = this.querySelector<HTMLElement>('.tc-deadzone-slider__value')
        if (!input) return
        input.addEventListener('input', () => {
            const v = parseFloat(input.value)
            if (display) display.textContent = `${Math.round(v * 100)}%`
            this.setAttribute('value', String(v))
            this.emit('tc-change', { value: v })
            if (typeof this.onChange === 'function') this.onChange(v)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DeadzoneSlider
    }
}
