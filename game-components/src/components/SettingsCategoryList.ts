import { html, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/SettingsCategoryList.scss'

export interface SettingsCategory { id: string; label: string; icon?: string }

@customElement('gc-settings-category-list')
export class SettingsCategoryList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) categories: SettingsCategory[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''

    @state() private _activeId: string | null = null

    render() {
        const active = this.selectedId || this._activeId || this.categories[0]?.id
        return html`
            <ul>${this.categories.map((c) => html`<li><button class=${c.id === active ? 'active' : ''}
                @click=${() => { this._activeId = c.id; this.emit('select', { id: c.id }) }}>
                ${c.icon ?? ''}<span>${c.label}</span>
            </button></li>`)}</ul>
            <div class="body"><slot name=${active ?? ''}></slot></div>`
    }
}
