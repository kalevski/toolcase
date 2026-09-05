import { SettingRowBase } from './SettingRowBase'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-select-row'

export interface SelectOption {
    value: string
    label: string
}

// tc-select-row — a generic labeled dropdown setting row. A label/description
// text block on the left paired with a native <select> on the right. Built on
// the shared SettingRowBase scaffold; the control reuses the design-system
// .form-select chrome. Port of game-components `gc-select-row` with the
// fantasy chrome dropped for the toolcase slate/ink look.

export class SelectRow extends SettingRowBase {
    private _options: SelectOption[] = []

    // Optional callback mirror of the `tc-change` event (see styleguide §events).
    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value', 'disabled']
    }

    attributeChangedCallback(name: string, old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        // Patch value/disabled in place — a full re-render would drop the
        // select's focus and any open native dropdown.
        if (name === 'value') {
            const select = this.querySelector<HTMLSelectElement>('.tc-select-row__select')
            if (select && select.value !== this.value) select.value = this.value
            return
        }
        if (name === 'disabled') {
            const select = this.querySelector<HTMLSelectElement>('.tc-select-row__select')
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

    get options(): SelectOption[] {
        return this._options.slice()
    }
    set options(values: SelectOption[]) {
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
                class="form-select form-select-sm tc-select-row__select"
                aria-label="${this.escape(this.rowLabel)}"${disabledAttr}
            >${optsMarkup}</select>
        `
    }

    protected bindControl(): void {
        const select = this.querySelector<HTMLSelectElement>('.tc-select-row__select')
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
        [TAG_NAME]: SelectRow
    }
}
