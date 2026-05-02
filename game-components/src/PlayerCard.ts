const TAG_NAME = 'gc-player-card'

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'

export interface PlayerCardStat {
    label: string
    value: string | number
}

export interface PlayerCardAction {
    id: string
    label: string
    danger?: boolean
}

export interface PlayerCardEventMap {
    action: CustomEvent<{ id: string }>
}

export class PlayerCard extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['player-name', 'card-title', 'rank', 'level', 'online-status']
    }

    private _stats: PlayerCardStat[] = []
    private _actions: PlayerCardAction[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get playerName(): string {
        return this.getAttribute('player-name') ?? ''
    }
    set playerName(v: string) {
        if (v) this.setAttribute('player-name', v)
        else this.removeAttribute('player-name')
    }

    get cardTitle(): string {
        return this.getAttribute('card-title') ?? ''
    }
    set cardTitle(v: string) {
        if (v) this.setAttribute('card-title', v)
        else this.removeAttribute('card-title')
    }

    get rank(): string {
        return this.getAttribute('rank') ?? ''
    }
    set rank(v: string) {
        if (v) this.setAttribute('rank', v)
        else this.removeAttribute('rank')
    }

    get level(): number | null {
        const raw = this.getAttribute('level')
        if (raw == null) return null
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) ? parsed : null
    }
    set level(v: number | null) {
        if (v == null) this.removeAttribute('level')
        else this.setAttribute('level', String(v))
    }

    get onlineStatus(): PresenceStatus {
        const raw = this.getAttribute('online-status')
        if (raw === 'online' || raw === 'away' || raw === 'busy' || raw === 'in-game' || raw === 'offline') return raw
        return 'offline'
    }
    set onlineStatus(v: PresenceStatus) {
        if (v) this.setAttribute('online-status', v)
        else this.removeAttribute('online-status')
    }

    get stats(): PlayerCardStat[] {
        return this._stats.slice()
    }
    set stats(v: PlayerCardStat[]) {
        this._stats = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    get actions(): PlayerCardAction[] {
        return this._actions.slice()
    }
    set actions(v: PlayerCardAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
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

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private statusLabel(status: PresenceStatus): string {
        switch (status) {
            case 'online': return 'Online'
            case 'away': return 'Away'
            case 'busy': return 'Busy'
            case 'in-game': return 'In Game'
            case 'offline':
            default: return 'Offline'
        }
    }

    private render(): void {
        const status = this.onlineStatus
        const level = this.level
        const rank = this.rank

        const headerMetaParts: string[] = []
        if (rank) headerMetaParts.push(`<span class="gc-player-card-rank">${this.escape(rank)}</span>`)
        if (level != null) headerMetaParts.push(`<span class="gc-player-card-level">Lv ${level}</span>`)
        const headerMetaMarkup = headerMetaParts.length
            ? `<div class="gc-player-card-meta">${headerMetaParts.join('')}</div>`
            : ''

        const statsMarkup = this._stats.map((stat) => {
            return `<div class="gc-player-card-stat">
                <span class="gc-player-card-stat-label">${this.escape(stat.label)}</span>
                <span class="gc-player-card-stat-value">${this.escape(this.formatValue(stat.value))}</span>
            </div>`
        }).join('')
        const statsBlock = statsMarkup
            ? `<div class="gc-player-card-stats">${statsMarkup}</div>`
            : ''

        const actionsMarkup = this._actions.map((action) => {
            const variant = action.danger ? 'danger' : 'default'
            return `<gc-metal-button class="gc-player-card-action" size="sm" variant="${variant}" data-id="${this.escape(action.id)}">${this.escape(action.label)}</gc-metal-button>`
        }).join('')
        const actionsBlock = actionsMarkup
            ? `<div class="gc-player-card-actions">${actionsMarkup}</div>`
            : ''

        const cardTitle = this.cardTitle
        const cardTitleMarkup = cardTitle
            ? `<div class="gc-player-card-title">${this.escape(cardTitle)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-player-card-root">
                <div class="gc-player-card-header">
                    <div class="gc-player-card-identity">
                        <span class="gc-player-card-name">${this.escape(this.playerName)}</span>
                        ${cardTitleMarkup}
                    </div>
                    <div class="gc-player-card-presence" data-status="${status}">
                        <span class="gc-player-card-pip"></span>
                        <span class="gc-player-card-status-label">${this.escape(this.statusLabel(status))}</span>
                    </div>
                </div>
                ${headerMetaMarkup}
                <div class="gc-player-card-divider"><span class="gc-player-card-rule"></span><span class="gc-player-card-diamond"></span><span class="gc-player-card-rule"></span></div>
                ${statsBlock}
                ${actionsBlock}
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-player-card-action').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.id || ''
                if (!id) return
                this.emit('action', { id })
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PlayerCard)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlayerCard
    }
}
