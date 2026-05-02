import { html, type TemplateResult, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { SettingRowBase } from './_setting-row-base.js'
import stylesText from '../../style/VolumeSlider.scss'

@customElement('gc-volume-slider')
export class VolumeSlider extends SettingRowBase {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) value = 1
    @property({ type: Boolean }) muted = false

    constructor() { super(); this.rowLabel = 'Volume' }

    protected renderControl(): TemplateResult {
        const v = this.muted ? 0 : this.value
        return html`<div class="row">
            <button class="mute" style=${`color: ${this.muted ? 'var(--gc-danger)' : 'var(--gc-fg)'}`} @click=${() => this.emit('toggle-mute')}>${this.muted ? '🔇' : '🔊'}</button>
            <input type="range" min="0" max="1" step="0.01" .value=${String(v)}
                @input=${(event: Event) => this.emit('change', { value: Number((event.target as HTMLInputElement).value) })} />
            <span class="value">${Math.round(v * 100)}%</span>
        </div>`
    }
}
