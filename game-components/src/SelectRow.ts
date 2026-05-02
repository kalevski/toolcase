import { SettingRowBase } from './SettingRowBase'

const TAG_NAME = 'gc-select-row'

export interface SelectOption {
    value: string
    label: string
}

export class SelectRow extends SettingRowBase {

    static get observedAttributes(): string[] {
        return [...SettingRowBase.observedAttributes, 'value']
    }

    private _options: SelectOption[] = []

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        this.setAttribute('value', v)
    }

    get options(): SelectOption[] {
        return this._options.slice()
    }
    set options(values: SelectOption[]) {
        this._options = Array.isArray(values) ? values.slice() : []
        if (this.isConnected) this.renderRow()
    }

    protected renderControl(): string {
        const value = this.value
        const optsMarkup = this._options.map(opt => {
            const selected = opt.value === value ? 'selected' : ''
            return `<option value="${this.escape(opt.value)}" ${selected}>${this.escape(opt.label)}</option>`
        }).join('')
        return `<select class="gc-setting-row-select">${optsMarkup}</select>`
    }

    protected bindControl(): void {
        const select = this.querySelector('.gc-setting-row-select') as HTMLSelectElement | null
        if (!select) return
        select.addEventListener('change', () => {
            const v = select.value
            this.setAttribute('value', v)
            this.emit('change', { value: v })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SelectRow
    }
}
