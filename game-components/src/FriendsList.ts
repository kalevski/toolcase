const TAG_NAME = 'gc-friends-list'

export type FriendStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'

export interface Friend {
    id: string
    name: string
    status?: FriendStatus
    activity?: string
    rank?: string
}

export interface FriendsListEventMap {
    invite: CustomEvent<{ id: string }>
    message: CustomEvent<{ id: string }>
}

export class FriendsList extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['list-title']
    }

    private _friends: Friend[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get listTitle(): string {
        return this.getAttribute('list-title') ?? 'Friends'
    }
    set listTitle(v: string) {
        if (v) this.setAttribute('list-title', v)
        else this.removeAttribute('list-title')
    }

    get friends(): Friend[] {
        return this._friends.slice()
    }
    set friends(value: Friend[]) {
        this._friends = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private statusOrder(status?: FriendStatus): number {
        switch (status) {
            case 'in-game': return 0
            case 'online': return 1
            case 'busy': return 2
            case 'away': return 3
            case 'offline': return 4
            default: return 5
        }
    }

    private render(): void {
        const sorted = this._friends.slice().sort((a, b) => {
            const oa = this.statusOrder(a.status)
            const ob = this.statusOrder(b.status)
            if (oa !== ob) return oa - ob
            return a.name.localeCompare(b.name)
        })

        const rowsMarkup = sorted.map((f) => {
            const status = f.status ?? 'offline'
            const cls = `gc-friends-list-row is-${status}`
            const activity = f.activity ? this.escape(f.activity) : (status === 'offline' ? 'Offline' : '')
            const activityMarkup = activity
                ? `<span class="gc-friends-list-activity">${activity}</span>`
                : ''
            const rankMarkup = f.rank
                ? `<span class="gc-friends-list-rank">${this.escape(f.rank)}</span>`
                : ''
            return `<div role="listitem" class="${cls}" data-id="${this.escape(f.id)}">
                <span class="gc-friends-list-pip"></span>
                <div class="gc-friends-list-text">
                    <span class="gc-friends-list-name">${this.escape(f.name)}</span>
                    ${activityMarkup}
                </div>
                ${rankMarkup}
                <div class="gc-friends-list-actions">
                    <button type="button" class="gc-friends-list-action" data-action="message" aria-label="Message ${this.escape(f.name)}">✉</button>
                    <button type="button" class="gc-friends-list-action" data-action="invite" aria-label="Invite ${this.escape(f.name)}">＋</button>
                </div>
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-friends-list-header">
                <gc-eyebrow class="gc-friends-list-eyebrow">${this.escape(this.listTitle)}</gc-eyebrow>
                <span class="gc-friends-list-count">${this._friends.filter((f) => f.status && f.status !== 'offline').length}/${this._friends.length}</span>
            </div>
            <div class="gc-friends-list-body">${rowsMarkup}</div>
        `

        this.querySelectorAll<HTMLElement>('.gc-friends-list-action').forEach((el) => {
            el.addEventListener('click', (event) => {
                event.stopPropagation()
                const row = el.closest('.gc-friends-list-row') as HTMLElement | null
                if (!row) return
                const id = row.dataset.id || ''
                const action = el.dataset.action || ''
                if (action === 'invite') this.emit('invite', { id })
                else if (action === 'message') this.emit('message', { id })
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, FriendsList)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FriendsList
    }
}
