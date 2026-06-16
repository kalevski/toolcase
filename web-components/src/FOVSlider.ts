import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-fov-slider'

// tc-fov-slider — a field-of-view preset row. A native range input paired with a
// mono degree readout, built on the shared setting-row scaffold. Port of
// game-components `gc-fov-slider` with the fantasy chrome dropped for the
// toolcase slate/ink look.

export class FOVSlider extends SettingRowBase {

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'min', 'max', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Field of View')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch the value in place — a full re-render would destroy the input
        // (and the active drag) on every `input` event.
        if (name === 'value') {
            const input = this.querySelector<HTMLInputElement>('.tc-fov-slider__input')
            const display = this.querySelector<HTMLElement>('.tc-fov-slider__value')
            const v = this.value
            if (input && input.value !== String(v)) input.value = String(v)
            if (display) display.textContent = `${Math.round(v)}°`
            return
        }
        super.attributeChangedCallback(name, old, next)
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 90
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 90 : parsed
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get min(): number {
        const raw = this.getAttribute('min')
        if (raw == null) return 60
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 60 : parsed
    }
    set min(v: number) {
        this.setAttribute('min', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 120
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 120 : parsed
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
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
        const min = this.min
        const max = this.max
        const disabledAttr = this.disabled ? ' disabled' : ''
        return `
            <div class="tc-fov-slider__control">
                <input
                    type="range"
                    class="tc-fov-slider__input"
                    min="${min}"
                    max="${max}"
                    step="1"
                    value="${value}"
                    aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
                />
                <span class="tc-fov-slider__value">${Math.round(value)}°</span>
            </div>
        `
    }

    protected bindControl(): void {
        const input = this.querySelector<HTMLInputElement>('.tc-fov-slider__input')
        const display = this.querySelector<HTMLElement>('.tc-fov-slider__value')
        if (!input) return
        input.addEventListener('input', () => {
            const v = parseFloat(input.value)
            if (display) display.textContent = `${Math.round(v)}°`
            this.setAttribute('value', String(v))
            this.emit('tc-change', { value: v })
            if (typeof this.onChange === 'function') this.onChange(v)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FOVSlider
    }
}
