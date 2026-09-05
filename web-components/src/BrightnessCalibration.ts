import { bindOnce, patchHtml } from './internal/patch-html'
const TAG_NAME = 'tc-brightness-calibration'

const DEFAULT_VALUE = 0.5

export class BrightnessCalibration extends HTMLElement {
    private _initialised = false

    // Optional callback mirror of the `tc-change` CustomEvent.
    onChange: ((value: number) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        // `value` is the only observed attribute; patch in place so a live
        // drag (and input focus) survives external/programmatic updates.
        this._patchValue()
    }

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return DEFAULT_VALUE
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? DEFAULT_VALUE : Math.max(0, Math.min(1, parsed))
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    // Maps the 0..1 brightness value to a CSS `brightness()` filter; lower
    // values darken the reference swatches, higher values lift them.
    private _gammaFilter(value: number): string {
        const gamma = (1 - value) * 1.5 + 0.5
        return `brightness(${gamma.toFixed(2)})`
    }

    private _emitChange(value: number): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    // Surgical update for the `value` attribute — never rewrites innerHTML.
    private _patchValue(): void {
        const value = this.value
        this.style.setProperty('--bs-brightness-calibration-gamma', this._gammaFilter(value))
        const input = this.querySelector<HTMLInputElement>('.tc-brightness-calibration__input')
        const out = this.querySelector<HTMLElement>('.tc-brightness-calibration__row-value')
        if (input && parseFloat(input.value) !== value) input.value = String(value)
        if (out) out.textContent = `${Math.round(value * 100)}%`
    }

    private render(): void {
        const value = this.value
        this.style.setProperty('--bs-brightness-calibration-gamma', this._gammaFilter(value))

        this.classList.add('tc-brightness-calibration')
        patchHtml(
            this,
            `
            <div class="tc-brightness-calibration__preview">
                <div class="tc-brightness-calibration__band tc-brightness-calibration__band--dark">
                    <span class="tc-brightness-calibration__band-label">Should be barely visible</span>
                </div>
                <div class="tc-brightness-calibration__band tc-brightness-calibration__band--mid">
                    <span class="tc-brightness-calibration__band-label">Should be clear</span>
                </div>
                <div class="tc-brightness-calibration__band tc-brightness-calibration__band--bright">
                    <span class="tc-brightness-calibration__band-label">Should not blow out</span>
                </div>
            </div>
            <div class="tc-brightness-calibration__row">
                <span class="tc-brightness-calibration__row-label">Brightness</span>
                <input type="range" class="form-range tc-brightness-calibration__input" min="0" max="1" step="0.01" value="${value}" aria-label="Brightness">
                <span class="tc-brightness-calibration__row-value">${Math.round(value * 100)}%</span>
            </div>
        `,
        )

        const input = this.querySelector<HTMLInputElement>('.tc-brightness-calibration__input')
        if (input) {
            bindOnce(input, 'input', () => {
                const parsed = parseFloat(input.value)
                const clamped = Number.isNaN(parsed)
                    ? DEFAULT_VALUE
                    : Math.max(0, Math.min(1, parsed))
                // setAttribute triggers _patchValue() which refreshes the
                // percentage readout and the preview gamma in place.
                this.setAttribute('value', String(clamped))
                this._emitChange(clamped)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BrightnessCalibration
    }
}
