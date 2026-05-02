import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/PressAnyKey.styles.js'

@customElement('gc-press-any-key')
export class PressAnyKey extends GameElement {
    static styles = styles

    @property() text = 'Press any key to continue'

    private _onKey = (event: KeyboardEvent) => { event.preventDefault(); this.emit('continue') }
    private _onClick = () => this.emit('continue')

    connectedCallback(): void {
        super.connectedCallback()
        window.addEventListener('keydown', this._onKey)
        window.addEventListener('mousedown', this._onClick)
    }
    disconnectedCallback(): void {
        window.removeEventListener('keydown', this._onKey)
        window.removeEventListener('mousedown', this._onClick)
        super.disconnectedCallback()
    }

    render() {
        return html`${this.text}`
    }
}
