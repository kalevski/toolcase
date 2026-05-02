import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Codex.scss'

export interface CodexEntry {
    id: string
    name: string
    icon?: string
    discovered?: boolean
    description?: string
    stats?: Array<{ label: string; value: string }>
}

@customElement('gc-codex')
export class Codex extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) entries: CodexEntry[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''

    @state() private _activeId: string | null = null

    render() {
        const activeId = this.selectedId || this._activeId || this.entries[0]?.id
        const active = this.entries.find((entry) => entry.id === activeId)
        return html`
            <div class="grid">${this.entries.map((entry) => html`<button
                class="${entry.id === activeId ? 'active' : ''} ${!entry.discovered ? 'undiscovered' : ''}"
                @click=${() => { this._activeId = entry.id }}>
                ${entry.discovered ? (entry.icon ?? '?') : '?'}
            </button>`)}</div>
            ${active ? html`<div class="detail">
                <h3>${active.discovered ? active.name : 'Unknown'}</h3>
                ${active.discovered ? html`
                    ${active.description ? html`<p style="font-size:13px;line-height:1.5">${active.description}</p>` : nothing}
                    ${active.stats ? html`<ul>${active.stats.map((stat) => html`<li><span style="opacity:0.7">${stat.label}</span><span>${stat.value}</span></li>`)}</ul>` : nothing}
                ` : html`<p style="opacity:0.5">You have not yet discovered this entry.</p>`}
            </div>` : nothing}`
    }
}
