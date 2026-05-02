import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Journal.scss'

export interface JournalEntry {
    id: string
    title: string
    description?: string
    body?: string
    objectives?: Array<{ text: string; completed?: boolean }>
    state?: 'active' | 'completed' | 'failed'
    rewards?: string
}

@customElement('gc-journal')
export class Journal extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) entries: JournalEntry[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''

    @state() private _activeId: string | null = null

    render() {
        const activeId = this.selectedId || this._activeId || this.entries[0]?.id
        const active = this.entries.find((entry) => entry.id === activeId)
        return html`
            <ul>${this.entries.map((entry) => html`<li><button class=${entry.id === activeId ? 'active' : ''}
                @click=${() => { this._activeId = entry.id }}>
                <div class="title">${entry.title}</div>
                <div class="state">${entry.state ?? 'active'}</div>
            </button></li>`)}</ul>
            ${active ? html`<div class="detail">
                <h2>${active.title}</h2>
                ${active.description ? html`<p style="opacity:0.8">${active.description}</p>` : nothing}
                ${active.objectives ? html`<ul class="objs">${active.objectives.map((o) => html`<li class=${o.completed ? 'done' : ''}>
                    <span class="dot ${o.completed ? 'completed' : ''}"></span>${o.text}
                </li>`)}</ul>` : nothing}
                ${active.body ? html`<div class="body">${active.body}</div>` : nothing}
                ${active.rewards ? html`<div class="rewards">Rewards: ${active.rewards}</div>` : nothing}
            </div>` : nothing}`
    }
}
