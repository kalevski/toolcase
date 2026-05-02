import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/PauseMenu.scss'
import './MainMenu.js'
import type { MainMenuItem } from './MainMenu.js'

@customElement('gc-pause-menu')
export class PauseMenu extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, reflect: true }) open = false
    @property({ type: Array }) items: MainMenuItem[] = []
    @property({ attribute: 'menu-title' }) menuTitle = 'Paused'

    private _onKey = (event: KeyboardEvent) => {
        if (this.open && event.key === 'Escape') { event.preventDefault(); this.emit('resume'); this.emit('close') }
    }

    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey); super.disconnectedCallback() }

    render() {
        if (!this.open) return nothing
        return html`<gc-main-menu .items=${this.items} menu-title=${this.menuTitle}
            @select=${(event: CustomEvent) => this.emit('select', event.detail)}></gc-main-menu>`
    }
}
