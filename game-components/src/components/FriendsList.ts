import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/FriendsList.styles.js'

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'

const COLORS: Record<PresenceStatus, string> = {
    online: '#3aa256', away: '#d2b73a', busy: '#d23a3a', offline: '#5a5f68', 'in-game': '#6aa9ff',
}

export interface Friend {
    id: string
    name: string
    status?: PresenceStatus
    activity?: string
    rank?: string
}

@customElement('gc-friends-list')
export class FriendsList extends GameElement {
    static styles = styles

    @property({ type: Array }) friends: Friend[] = []
    @property({ attribute: 'list-title' }) listTitle = 'Friends'

    render() {
        const order: PresenceStatus[] = ['in-game', 'online', 'away', 'busy', 'offline']
        const sorted = [...this.friends].sort((a, b) => order.indexOf(a.status ?? 'offline') - order.indexOf(b.status ?? 'offline'))
        const onlineCount = this.friends.filter((friend) => friend.status !== 'offline').length
        return html`
            <div class="head">${this.listTitle} (${onlineCount}/${this.friends.length})</div>
            <ul>${sorted.map((friend) => {
                const status = friend.status ?? 'offline'
                return html`<li class=${status === 'offline' ? 'offline' : ''}>
                    <div class="avatar">👤<div class="dot" style=${`background: ${COLORS[status]}`}></div></div>
                    <div class="info">
                        <div class="name">${friend.name}${friend.rank ? html`<span style="font-size:10px;opacity:0.6">· ${friend.rank}</span>` : nothing}</div>
                        <div class="activity">${friend.activity ?? status}</div>
                    </div>
                    <div class="actions">
                        <button class="invite" title="Invite" @click=${() => this.emit('invite', { id: friend.id })}>＋</button>
                        <button title="Message" @click=${() => this.emit('message', { id: friend.id })}>💬</button>
                    </div>
                </li>`
            })}</ul>`
    }
}
