import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-lobby'

export interface LobbyPlayer {
    id: string
    name: string
    ready?: boolean
    host?: boolean
    rank?: string
}

export interface LobbyEventMap {
    'tc-leave': CustomEvent<Record<string, never>>
    'tc-ready': CustomEvent<Record<string, never>>
    'tc-start': CustomEvent<Record<string, never>>
}

export class Lobby extends HTMLElement {
    private _initialised = false
    private _players: LobbyPlayer[] = []

    onLeave: (() => void) | null = null
    onReady: (() => void) | null = null
    onStart: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['capacity', 'lobby-mode', 'map-name', 'is-ready', 'can-start']
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

    get capacity(): number {
        const raw = this.getAttribute('capacity')
        if (raw == null) return 8
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 8
    }
    set capacity(v: number) {
        this.setAttribute('capacity', String(v))
    }

    get lobbyMode(): string {
        return this.getAttribute('lobby-mode') ?? ''
    }
    set lobbyMode(v: string) {
        if (v) this.setAttribute('lobby-mode', v)
        else this.removeAttribute('lobby-mode')
    }

    get mapName(): string {
        return this.getAttribute('map-name') ?? ''
    }
    set mapName(v: string) {
        if (v) this.setAttribute('map-name', v)
        else this.removeAttribute('map-name')
    }

    get isReady(): boolean {
        return this.hasAttribute('is-ready')
    }
    set isReady(v: boolean) {
        if (v) this.setAttribute('is-ready', '')
        else this.removeAttribute('is-ready')
    }

    get canStart(): boolean {
        return this.hasAttribute('can-start')
    }
    set canStart(v: boolean) {
        if (v) this.setAttribute('can-start', '')
        else this.removeAttribute('can-start')
    }

    get players(): LobbyPlayer[] {
        return this._players.slice()
    }
    set players(value: LobbyPlayer[]) {
        this._players = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private _emit(name: 'tc-leave' | 'tc-ready' | 'tc-start'): void {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail: {} }))
        if (name === 'tc-leave' && typeof this.onLeave === 'function') this.onLeave()
        else if (name === 'tc-ready' && typeof this.onReady === 'function') this.onReady()
        else if (name === 'tc-start' && typeof this.onStart === 'function') this.onStart()
    }

    private _renderSlot(i: number, players: LobbyPlayer[]): string {
        const p = players[i]
        if (!p) {
            return `<div class="tc-lobby-slot tc-lobby-slot--empty">
                <span class="tc-lobby-empty-label">Open Slot</span>
            </div>`
        }

        const cls = [
            'tc-lobby-slot',
            'tc-lobby-slot--filled',
            p.ready ? 'tc-lobby-slot--ready' : '',
        ]
            .filter(Boolean)
            .join(' ')

        const rankHtml = p.rank ? `<span class="tc-lobby-rank">${esc(p.rank)}</span>` : ''
        const hostHtml = p.host ? `<span class="tc-lobby-host-badge">Host</span>` : ''
        const readyHtml = p.ready
            ? `<span class="tc-lobby-ready-badge tc-lobby-ready-badge--ready">Ready</span>`
            : `<span class="tc-lobby-ready-badge tc-lobby-ready-badge--waiting">Waiting</span>`

        return `<div class="${cls}" data-id="${esc(p.id)}">
            <span class="tc-lobby-player-name">${esc(p.name)}</span>
            <span class="tc-lobby-player-meta">${rankHtml}${hostHtml}</span>
            ${readyHtml}
        </div>`
    }

    private render(): void {
        const capacity = this.capacity
        const players = this._players.slice(0, capacity)
        const isHost = players.some((p) => p.host)
        const filled = players.length

        const slots = Array.from({ length: capacity }, (_, i) => this._renderSlot(i, players)).join(
            '',
        )

        const metaCells: string[] = []
        if (this.lobbyMode) {
            metaCells.push(`<div class="tc-lobby-meta-cell">
                <span class="tc-lobby-meta-key">Mode</span>
                <span class="tc-lobby-meta-val">${esc(this.lobbyMode)}</span>
            </div>`)
        }
        if (this.mapName) {
            metaCells.push(`<div class="tc-lobby-meta-cell">
                <span class="tc-lobby-meta-key">Map</span>
                <span class="tc-lobby-meta-val">${esc(this.mapName)}</span>
            </div>`)
        }
        metaCells.push(`<div class="tc-lobby-meta-cell">
            <span class="tc-lobby-meta-key">Players</span>
            <span class="tc-lobby-meta-val">${filled}/${capacity}</span>
        </div>`)

        const readyBtnLabel = this.isReady ? 'Unready' : 'Ready Up'
        const readyBtnCls = this.isReady
            ? 'tc-lobby-btn tc-lobby-btn--ready tc-lobby-btn--active'
            : 'tc-lobby-btn tc-lobby-btn--ready'
        const startBtnHtml = isHost
            ? `<button type="button" class="tc-lobby-btn tc-lobby-btn--start" data-action="start"${this.canStart ? '' : ' disabled'}>Start Match</button>`
            : ''

        patchHtml(
            this,
            `
            <div class="tc-lobby">
                <div class="tc-lobby-header">
                    <span class="tc-lobby-eyebrow">Lobby</span>
                    <span class="tc-lobby-title">${esc(this.lobbyMode || 'Match')}</span>
                </div>
                <div class="tc-lobby-meta">${metaCells.join('')}</div>
                <div class="tc-lobby-slots">${slots}</div>
                <div class="tc-lobby-actions">
                    <button type="button" class="tc-lobby-btn tc-lobby-btn--leave" data-action="leave">Leave</button>
                    <button type="button" class="${readyBtnCls}" data-action="ready" aria-pressed="${this.isReady}">${readyBtnLabel}</button>
                    ${startBtnHtml}
                </div>
            </div>
        `,
        )

        // Delegate clicks on the fresh actions bar — old container + its
        // listener are garbage-collected together so no leak occurs.
        const actions = this.querySelector<HTMLElement>('.tc-lobby-actions')
        bindOnce(actions, 'click', (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')
            if (!btn || btn.disabled) return
            const action = btn.dataset.action
            if (action === 'leave') this._emit('tc-leave')
            else if (action === 'ready') this._emit('tc-ready')
            else if (action === 'start') this._emit('tc-start')
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Lobby
    }
}
