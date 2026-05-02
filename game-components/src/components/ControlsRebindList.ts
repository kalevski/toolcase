import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ControlsRebindList.styles.js'

export interface ControlBinding { id: string; action: string; key?: string }

@customElement('gc-controls-rebind-list')
export class ControlsRebindList extends GameElement {
    static styles = styles

    @property({ type: Array }) bindings: ControlBinding[] = []

    render() {
        return html`${this.bindings.map((b) => html`<div class="row">
            <div>${b.action}</div>
            <button @click=${() => this.emit('rebind', { id: b.id })}>${b.key ?? 'Unbound'}</button>
        </div>`)}`
    }
}
