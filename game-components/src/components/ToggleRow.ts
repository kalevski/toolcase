import { html, type TemplateResult, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import stylesText from '../../style/ToggleRow.scss'

@customElement('gc-toggle-row')
export class ToggleRow extends SettingRowBase {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean }) checked = false

    protected renderControl(): TemplateResult {
        return html`<label class="toggle">
            <input type="checkbox" ?checked=${this.checked}
                @change=${(event: Event) => this.emit('change', { value: (event.target as HTMLInputElement).checked })} />
            <span class="slider ${this.checked ? 'on' : ''}">
                <span class="knob ${this.checked ? 'on' : ''}"></span>
            </span>
        </label>`
    }
}
