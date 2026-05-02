import { html, type TemplateResult, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import stylesText from '../../style/GraphicsPresetPicker.scss'

const PRESETS = ['low', 'medium', 'high', 'ultra', 'custom']

@customElement('gc-graphics-preset-picker')
export class GraphicsPresetPicker extends SettingRowBase {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() value = 'medium'

    constructor() { super(); this.rowLabel = 'Quality preset' }

    protected renderControl(): TemplateResult {
        return html`<div class="presets">${PRESETS.map((p) => html`<button class=${this.value === p ? 'selected' : ''}
            @click=${() => this.emit('change', { value: p })}>${p}</button>`)}</div>`
    }
}
