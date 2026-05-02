import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/PlayerCard.scss'
import type { PresenceStatus } from './FriendsList.js'

const COLORS: Record<string, string> = {
    online: '#3aa256', away: '#d2b73a', busy: '#d23a3a', offline: '#5a5f68', 'in-game': '#6aa9ff',
}

@customElement('gc-player-card')
export class PlayerCard extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ attribute: 'player-name' }) playerName = ''
    @property({ attribute: 'card-title' }) cardTitle = ''
    @property() rank = ''
    @property({ type: Number }) level: number | null = null
    @property({ type: Array }) stats: Array<{ label: string; value: string }> = []
    @property({ type: Array }) actions: Array<{ id: string; label: string; danger?: boolean }> = []
    @property({ attribute: 'online-status' }) onlineStatus: PresenceStatus = 'offline'

    render() {
        return html`
            <div class="head">
                <div class="avatar">👤<div class="dot" style=${`background: ${COLORS[this.onlineStatus]}`}></div></div>
                <div style="flex:1">
                    <div class="name">${this.playerName}</div>
                    ${this.cardTitle ? html`<div class="title">${this.cardTitle}</div>` : nothing}
                    <div class="meta">
                        ${this.level !== null ? html`<span>Lv ${this.level}</span>` : nothing}
                        ${this.rank ? html`<span>${this.rank}</span>` : nothing}
                    </div>
                </div>
            </div>
            ${this.stats.length ? html`<ul>${this.stats.map((s) => html`<li><span style="opacity:0.7">${s.label}</span><span>${s.value}</span></li>`)}</ul>` : nothing}
            ${this.actions.length ? html`<div class="actions">${this.actions.map((a) => html`
                <button class=${a.danger ? 'danger' : 'normal'} @click=${() => this.emit('action', { id: a.id })}>${a.label}</button>
            `)}</div>` : nothing}`
    }
}
