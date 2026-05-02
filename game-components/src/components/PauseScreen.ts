import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/PauseScreen.styles.js'
import './MainMenu.js'
import type { MainMenuItem } from './MainMenu.js'

const DEFAULT_ITEMS: MainMenuItem[] = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'quit', label: 'Quit' },
]

@customElement('gc-pause-screen')
export class PauseScreen extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) open = false
    @property({ attribute: 'screen-title' }) screenTitle = 'Paused'
    @property({ type: Array }) items: MainMenuItem[] = DEFAULT_ITEMS

    private _onKey = (event: KeyboardEvent) => { if (this.open && event.key === 'Escape') { event.preventDefault(); this.emit('resume') } }
    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey); super.disconnectedCallback() }

    private _onSelect(event: CustomEvent): void {
        const id = event.detail.id
        this.emit('select', { id })
        if (id === 'resume') this.emit('resume')
        else if (id === 'restart') this.emit('restart')
        else if (id === 'quit') this.emit('quit')
    }

    render() {
        if (!this.open) return nothing
        return html`<gc-main-menu .items=${this.items} menu-title=${this.screenTitle} @select=${this._onSelect}></gc-main-menu>`
    }
}
