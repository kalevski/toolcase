import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/TabBar.scss'

export interface TabItem { id: string; label: string; icon?: string }

@customElement('gc-tab-bar')
export class TabBar extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) tabs: TabItem[] = []
    @property({ attribute: 'active-id' }) activeId = ''
    @property() size: 'sm' | 'md' = 'md'

    render() {
        const active = this.activeId || this.tabs[0]?.id
        return html`<div class="bar s-${this.size}">
            ${this.tabs.map((tab) => html`<button
                class="tab ${tab.id === active ? 'active' : ''}"
                @click=${() => this.emit('change', { id: tab.id })}
            >
                ${tab.icon ? html`<span class="icon">${tab.icon}</span>` : nothing}
                <span>${tab.label}</span>
            </button>`)}
        </div>`
    }
}
