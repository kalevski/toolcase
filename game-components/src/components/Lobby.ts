import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Lobby.styles.js'

export interface LobbyPlayer { id: string; name: string; ready?: boolean; host?: boolean; rank?: string }

@customElement('gc-lobby')
export class Lobby extends GameElement {
    static styles = styles

    @property({ type: Array }) players: LobbyPlayer[] = []
    @property({ type: Number }) capacity = 4
    @property({ attribute: 'lobby-mode' }) lobbyMode = '—'
    @property({ attribute: 'map-name' }) mapName = '—'
    @property({ type: Boolean, attribute: 'is-ready' }) isReady = false
    @property({ type: Boolean, attribute: 'can-start' }) canStart = false

    render() {
        const slots = Array.from({ length: this.capacity }, (_, i) => this.players[i] ?? null)
        return html`
            <div class="head">
                <div><strong>Mode:</strong> ${this.lobbyMode}</div>
                <div><strong>Map:</strong> ${this.mapName}</div>
                <div>${this.players.length} / ${this.capacity}</div>
            </div>
            <div class="slots">${slots.map((p) => p ? html`<div class="slot">
                <div class="avatar">👤</div>
                <div style="flex:1">
                    ${p.host ? html`<span class="host">★</span> ` : nothing}${p.name}
                    ${p.rank ? html`<div class="rank">${p.rank}</div>` : nothing}
                </div>
                <div class="ready-dot ${p.ready ? 'ready' : ''}"></div>
            </div>` : html`<div class="slot empty">Open slot...</div>`)}</div>
            <slot name="chat"></slot>
            <div class="actions">
                <button class="leave" @click=${() => this.emit('leave')}>Leave</button>
                <div style="display:flex;gap:8px">
                    <button class="ready-btn ${this.isReady ? 'ready' : ''}" @click=${() => this.emit('ready')}>${this.isReady ? 'Ready' : 'Not Ready'}</button>
                    <button class="start ${this.canStart ? 'can' : ''}" ?disabled=${!this.canStart} @click=${() => this.canStart && this.emit('start')}>Start</button>
                </div>
            </div>`
    }
}
