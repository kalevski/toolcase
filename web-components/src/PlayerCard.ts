const TAG_NAME = 'tc-player-card'

export type PresenceStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'
const PRESENCE_STATUSES: PresenceStatus[] = ['online', 'away', 'busy', 'offline', 'in-game']

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
    'tc-action': CustomEvent<{ id: string }>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function statusLabel(status: PresenceStatus): string {
    switch (status) {
        case 'online':  return 'Online'
        case 'away':    return 'Away'
        case 'busy':    return 'Busy'
        case 'in-game': return 'In Game'
        case 'offline':
        default:        return 'Offline'
    }
}

export class PlayerCard extends HTMLElement {

    private _initialised = false
    private _stats: PlayerCardStat[] = []
    private _actions: PlayerCardAction[] = []

    onAction: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['player-name', 'card-title', 'rank', 'level', 'online-status']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        const raw = this.getAttribute('online-status') as PresenceStatus
        return PRESENCE_STATUSES.includes(raw) ? raw : 'offline'
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
        if (this._initialised) this.render()
    }

    get actions(): PlayerCardAction[] {
        return this._actions.slice()
    }
    set actions(v: PlayerCardAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _emit(id: string): void {
        this.dispatchEvent(new CustomEvent('tc-action', {
            bubbles: true,
            composed: true,
            detail: { id },
        }))
        if (typeof this.onAction === 'function') this.onAction(id)
    }

    private render(): void {
        const status = this.onlineStatus
        const level = this.level
        const rank = this.rank
        const cardTitle = this.cardTitle

        // ── Meta row (rank + level) ──────────────────────────────────────────
        const metaParts: string[] = []
        if (rank) {
            metaParts.push(`<span class="tc-player-card-rank">${esc(rank)}</span>`)
        }
        if (level != null) {
            metaParts.push(`<span class="tc-player-card-level">Lv&nbsp;${level}</span>`)
        }
        const metaHtml = metaParts.length
            ? `<div class="tc-player-card-meta">${metaParts.join('')}</div>`
            : ''

        // ── Stats ────────────────────────────────────────────────────────────
        const statsHtml = this._stats.length
            ? `<div class="tc-player-card-stats">${this._stats.map(s => {
                const val = typeof s.value === 'number' ? s.value.toLocaleString() : s.value
                return `<div class="tc-player-card-stat">
                    <span class="tc-player-card-stat-label">${esc(s.label)}</span>
                    <span class="tc-player-card-stat-value">${esc(String(val))}</span>
                </div>`
            }).join('')}</div>`
            : ''

        // ── Actions ──────────────────────────────────────────────────────────
        const actionsHtml = this._actions.length
            ? `<div class="tc-player-card-actions">${this._actions.map((a, i) => {
                const cls = [
                    'tc-player-card-action-btn',
                    a.danger ? 'tc-player-card-action-btn--danger' : '',
                ].filter(Boolean).join(' ')
                return `<button type="button" class="${cls}" data-idx="${i}" data-id="${esc(a.id)}">${esc(a.label)}</button>`
            }).join('')}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-player-card">
                <div class="tc-player-card-header">
                    <div class="tc-player-card-identity">
                        <span class="tc-player-card-name">${esc(this.playerName)}</span>
                        ${cardTitle ? `<span class="tc-player-card-card-title">${esc(cardTitle)}</span>` : ''}
                    </div>
                    <div class="tc-player-card-presence" data-status="${esc(status)}">
                        <span class="tc-player-card-pip" aria-hidden="true"></span>
                        <span class="tc-player-card-status-label">${statusLabel(status)}</span>
                    </div>
                </div>
                ${metaHtml}
                ${statsHtml}
                ${actionsHtml}
            </div>
        `

        // Delegate clicks on the fresh actions container — old container + its
        // listener are garbage-collected together so no leak occurs.
        const actionsEl = this.querySelector<HTMLElement>('.tc-player-card-actions')
        actionsEl?.addEventListener('click', (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-id]')
            if (!btn || btn.disabled) return
            const id = btn.dataset.id ?? ''
            if (!id) return
            this._emit(id)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlayerCard
    }
}
