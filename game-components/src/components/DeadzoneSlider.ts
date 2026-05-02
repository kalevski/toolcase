import { html, type TemplateResult, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import stylesText from '../../style/DeadzoneSlider.scss'

@customElement('gc-deadzone-slider')
export class DeadzoneSlider extends SettingRowBase {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) value = 0.1

    constructor() { super(); this.rowLabel = 'Stick Deadzone' }

    protected renderControl(): TemplateResult {
        return html`<input type="range" min="0" max="0.5" step="0.01" .value=${String(this.value)}
            @input=${(event: Event) => this.emit('change', { value: Number((event.target as HTMLInputElement).value) })} />`
    }
}
