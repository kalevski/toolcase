import { html, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import { styles } from '../styles/SelectRow.styles.js'

export interface SelectOption { value: string | number; label: string }

@customElement('gc-select-row')
export class SelectRow extends SettingRowBase {
    static styles = styles

    @property() value: string | number = ''
    @property({ type: Array }) options: SelectOption[] = []

    protected renderControl(): TemplateResult {
        return html`<select @change=${(event: Event) => {
            const value = (event.target as HTMLSelectElement).value
            const numericFirst = typeof this.options[0]?.value === 'number'
            this.emit('change', { value: numericFirst ? Number(value) : value })
        }}>
            ${this.options.map((option) => html`<option value=${String(option.value)} ?selected=${option.value === this.value}>${option.label}</option>`)}
        </select>`
    }
}
