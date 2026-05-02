import { html, type TemplateResult, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import stylesText from '../../style/FOVSlider.scss'

@customElement('gc-fov-slider')
export class FOVSlider extends SettingRowBase {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) value = 90
    @property({ type: Number }) min = 60
    @property({ type: Number }) max = 120

    constructor() { super(); this.rowLabel = 'Field of View' }

    protected renderControl(): TemplateResult {
        return html`<div class="row">
            <input type="range" min=${this.min} max=${this.max} .value=${String(this.value)}
                @input=${(event: Event) => this.emit('change', { value: Number((event.target as HTMLInputElement).value) })} />
            <span class="value">${this.value}°</span>
        </div>`
    }
}
