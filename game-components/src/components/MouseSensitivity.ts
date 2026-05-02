import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/MouseSensitivity.scss'

@customElement('gc-mouse-sensitivity')
export class MouseSensitivity extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) value = 1
    @property({ type: Number }) ads: number | null = null

    render() {
        return html`
            <div class="row"><div>Mouse Sensitivity</div><input type="range" min="0.1" max="5" step="0.05" .value=${String(this.value)}
                @input=${(event: Event) => this.emit('change', { key: 'value', value: Number((event.target as HTMLInputElement).value) })} /></div>
            ${this.ads !== null ? html`<div class="row"><div>ADS Sensitivity</div><input type="range" min="0.1" max="5" step="0.05" .value=${String(this.ads)}
                @input=${(event: Event) => this.emit('change', { key: 'ads', value: Number((event.target as HTMLInputElement).value) })} /></div>` : nothing}`
    }
}
