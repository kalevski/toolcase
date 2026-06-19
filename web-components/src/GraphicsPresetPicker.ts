import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'tc-graphics-preset-picker'

export interface GraphicsPreset {
    value: string
    label: string
}

// The fixed low/medium/high/ultra ramp the gc-* original ships with.
const PRESETS: GraphicsPreset[] = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'ultra', label: 'Ultra' },
]

// tc-graphics-preset-picker — a low / medium / high / ultra graphics-preset
// picker. A segmented button group paired with the shared setting-row scaffold.
// Port of game-components `gc-graphics-preset-picker` with the fantasy chrome
// dropped for the toolcase slate/ink look; the active segment carries the ink
// fill from the standard state ladder. All cosmetics flow through
// `--bs-graphics-preset-picker-*`.
export class GraphicsPresetPicker extends SettingRowBase {
    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('row-label')) this.setAttribute('row-label', 'Quality preset')
        if (!this.hasAttribute('value')) this.setAttribute('value', 'medium')
        super.connectedCallback()
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch active/disabled state in place — a full re-render would drop the
        // focused segment on every selection.
        if (name === 'value') {
            this._patchActive()
            return
        }
        if (name === 'disabled') {
            const disabled = this.disabled
            this.querySelectorAll<HTMLButtonElement>('.tc-graphics-preset-picker__preset').forEach(
                (btn) => {
                    btn.disabled = disabled
                },
            )
            return
        }
        super.attributeChangedCallback(name, old, next)
    }

    get value(): string {
        return this.getAttribute('value') ?? 'medium'
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // Reflect the current value onto each segment without rebuilding the markup.
    private _patchActive(): void {
        const value = this.value
        this.querySelectorAll<HTMLButtonElement>('.tc-graphics-preset-picker__preset').forEach(
            (btn) => {
                const active = btn.dataset.value === value
                btn.dataset.active = String(active)
                btn.setAttribute('aria-pressed', String(active))
            },
        )
    }

    protected renderControl(): string {
        const value = this.value
        const disabled = this.disabled
        const buttons = PRESETS.map((p) => {
            const active = p.value === value
            return `
                <button
                    type="button"
                    class="tc-graphics-preset-picker__preset"
                    data-value="${this.escape(p.value)}"
                    data-active="${active}"
                    aria-pressed="${active}"${disabled ? ' disabled' : ''}
                >${this.escape(p.label)}</button>
            `
        }).join('')
        return `
            <div
                class="tc-graphics-preset-picker__group"
                role="group"
                aria-label="${this.escape(this.rowLabel)}"
            >${buttons}</div>
        `
    }

    protected bindControl(): void {
        const buttons = this.querySelectorAll<HTMLButtonElement>(
            '.tc-graphics-preset-picker__preset',
        )
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (this.disabled) return
                const v = btn.dataset.value ?? 'medium'
                this.setAttribute('value', v)
                this.emit('tc-change', { value: v })
                if (typeof this.onChange === 'function') this.onChange(v)
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GraphicsPresetPicker
    }
}
