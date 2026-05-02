import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/InteractPrompt.scss'

@customElement('gc-interact-prompt')
export class InteractPrompt extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean }) show = false
    @property({ attribute: 'key-label' }) keyLabel = 'E'
    @property() text = ''
    @property({ type: Number, attribute: 'hold-progress' }) holdProgress: number | null = null

    render() {
        if (!this.show) return nothing
        const hold = this.holdProgress === null ? null : Math.max(0, Math.min(1, this.holdProgress))
        return html`<span class="key">
            ${hold !== null ? html`<span class="fill" style="width: ${hold * 100}%"></span>` : nothing}
            <span class="txt">${this.keyLabel}</span>
        </span>
        <span>${this.text}</span>`
    }
}
