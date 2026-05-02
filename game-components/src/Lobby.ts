const TAG_NAME = 'gc-lobby'

export interface LobbyPlayer {
    id: string
    name: string
    ready?: boolean
    host?: boolean
    rank?: string
}

export interface LobbyEventMap {
    leave: CustomEvent<void>
    ready: CustomEvent<void>
    start: CustomEvent<void>
}

export class Lobby extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['capacity', 'lobby-mode', 'map-name', 'is-ready', 'can-start']
    }

    private _players: LobbyPlayer[] = []

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

    private render(): void {
        const capacity = this.capacity
        const players = this._players.slice(0, capacity)
        const slots: string[] = []

        for (let i = 0; i < capacity; i++) {
            const p = players[i]
            if (p) {
                const cls = `gc-lobby-slot is-filled${p.ready ? ' is-ready' : ''}`
                const hostMarkup = p.host ? `<span class="gc-lobby-host">★ Host</span>` : ''
                const rankMarkup = p.rank
                    ? `<span class="gc-lobby-rank">${this.escape(p.rank)}</span>`
                    : ''
                const readyMarkup = p.ready
                    ? `<span class="gc-lobby-ready">Ready</span>`
                    : `<span class="gc-lobby-not-ready">Waiting</span>`
                slots.push(`<div class="${cls}" data-id="${this.escape(p.id)}">
                    <span class="gc-lobby-name">${this.escape(p.name)}</span>
                    ${rankMarkup}
                    ${hostMarkup}
                    ${readyMarkup}
                </div>`)
            } else {
                slots.push(`<div class="gc-lobby-slot is-empty">
                    <span class="gc-lobby-empty-label">Open Slot</span>
                </div>`)
            }
        }

        const meta: string[] = []
        if (this.lobbyMode) meta.push(`<div class="gc-lobby-meta-cell"><gc-eyebrow>Mode</gc-eyebrow><span class="gc-lobby-meta-value">${this.escape(this.lobbyMode)}</span></div>`)
        if (this.mapName) meta.push(`<div class="gc-lobby-meta-cell"><gc-eyebrow>Map</gc-eyebrow><span class="gc-lobby-meta-value">${this.escape(this.mapName)}</span></div>`)
        meta.push(`<div class="gc-lobby-meta-cell"><gc-eyebrow>Players</gc-eyebrow><span class="gc-lobby-meta-value">${players.length}/${capacity}</span></div>`)

        const isHost = players.some((p) => p.host && p.id === (players.find((q) => q.host)?.id))
        const startMarkup = isHost
            ? `<button type="button" class="gc-lobby-start" ${this.canStart ? '' : 'disabled'}>Start Match</button>`
            : ''
        const readyBtnLabel = this.isReady ? 'Unready' : 'Ready Up'
        const readyBtnCls = this.isReady ? 'gc-lobby-ready-btn is-active' : 'gc-lobby-ready-btn'

        this.innerHTML = `
            <div class="gc-lobby-header">
                <gc-eyebrow class="gc-lobby-eyebrow">Lobby</gc-eyebrow>
                <gc-title class="gc-lobby-title">${this.escape(this.lobbyMode || 'Match')}</gc-title>
            </div>
            <div class="gc-lobby-meta">${meta.join('')}</div>
            <div class="gc-lobby-slots">${slots.join('')}</div>
            <div class="gc-lobby-actions">
                <button type="button" class="gc-lobby-leave">Leave</button>
                <button type="button" class="${readyBtnCls}">${readyBtnLabel}</button>
                ${startMarkup}
            </div>
        `

        const leaveBtn = this.querySelector('.gc-lobby-leave') as HTMLButtonElement | null
        if (leaveBtn) leaveBtn.addEventListener('click', () => this.emit('leave'))
        const readyBtn = this.querySelector('.gc-lobby-ready-btn') as HTMLButtonElement | null
        if (readyBtn) readyBtn.addEventListener('click', () => this.emit('ready'))
        const startBtn = this.querySelector('.gc-lobby-start') as HTMLButtonElement | null
        if (startBtn) startBtn.addEventListener('click', () => this.emit('start'))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Lobby)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Lobby
    }
}
