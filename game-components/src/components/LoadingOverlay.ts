import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/LoadingOverlay.styles.js'

@customElement('gc-loading-overlay')
export class LoadingOverlay extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) open = false
    @property({ type: Number }) progress: number | null = null
    @property() label = 'Loading...'
    @property() tip = ''

    render() {
        if (!this.open) return nothing
        const pct = this.progress === null ? null : Math.max(0, Math.min(1, this.progress))
        return html`<div class="box">
            <div class="label">${this.label}</div>
            ${pct !== null ? html`<div class="bar"><div class="fill" style="width: ${pct * 100}%"></div></div>` : nothing}
            ${this.tip ? html`<div class="tip">${this.tip}</div>` : nothing}
        </div>`
    }
}
