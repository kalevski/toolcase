import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ControlsRebindList.scss'

export interface ControlBinding { id: string; action: string; key?: string }

@customElement('gc-controls-rebind-list')
export class ControlsRebindList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) bindings: ControlBinding[] = []

    render() {
        return html`${this.bindings.map((b) => html`<div class="row">
            <div>${b.action}</div>
            <button @click=${() => this.emit('rebind', { id: b.id })}>${b.key ?? 'Unbound'}</button>
        </div>`)}`
    }
}
