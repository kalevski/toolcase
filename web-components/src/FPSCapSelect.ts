import { SettingRowBase } from './SettingRowBase'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-fps-cap-select'

export interface FPSCapOption {
    value: string
    label: string
}

// The preset FPS caps the gc-* original ships with. Used when the author leaves
// the `options` JS property untouched.
const DEFAULT_OPTIONS: FPSCapOption[] = [
    { value: '30', label: '30 FPS' },
    { value: '60', label: '60 FPS' },
    { value: '120', label: '120 FPS' },
    { value: '144', label: '144 FPS' },
    { value: '240', label: '240 FPS' },
    { value: '0', label: 'Unlimited' },
]

// tc-fps-cap-select — a preset FPS-cap picker. A native <select> of frame-rate
// presets paired with the shared setting-row scaffold. Port of game-components
// `gc-fps-cap-select` with the fantasy chrome dropped for the toolcase
// slate/ink look; the control reuses the design-system `.form-select` chrome.
export class FPSCapSelect extends SettingRowBase {
    private _options: FPSCapOption[] = DEFAULT_OPTIONS.slice()

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'FPS Cap')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch value/disabled in place — a full re-render would drop the
        // select's focus and any open native dropdown.
        if (name === 'value') {
            const select = this.querySelector<HTMLSelectElement>('.tc-fps-cap-select__select')
            if (select && select.value !== this.value) select.value = this.value
            return
        }
        if (name === 'disabled') {
            const select = this.querySelector<HTMLSelectElement>('.tc-fps-cap-select__select')
            if (select) select.disabled = this.disabled
            return
        }
        super.attributeChangedCallback(name, old, next)
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        setAttr(this, 'value', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get options(): FPSCapOption[] {
        return this._options.slice()
    }
    set options(values: FPSCapOption[]) {
        this._options = Array.isArray(values) ? values.slice() : []
        if (this._initialised) this.renderRow()
    }

    protected renderControl(): string {
        const value = this.value
        const disabledAttr = this.disabled ? ' disabled' : ''
        const optsMarkup = this._options
            .map((opt) => {
                const selected = opt.value === value ? ' selected' : ''
                return `<option value="${this.escape(opt.value)}"${selected}>${this.escape(opt.label)}</option>`
            })
            .join('')
        return `
            <select
                class="form-select form-select-sm tc-fps-cap-select__select"
                aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
            >${optsMarkup}</select>
        `
    }

    protected bindControl(): void {
        const select = this.querySelector<HTMLSelectElement>('.tc-fps-cap-select__select')
        if (!select) return
        select.addEventListener('change', () => {
            const v = select.value
            this.setAttribute('value', v)
            this.emit('tc-change', { value: v })
            if (typeof this.onChange === 'function') this.onChange(v)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FPSCapSelect
    }
}
