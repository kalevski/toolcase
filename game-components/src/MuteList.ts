const TAG_NAME = 'gc-mute-list'

export interface MutedPlayer {
    id: string
    name: string
    mutedAt?: string
    reason?: string
}

export interface MuteListEventMap {
    unmute: CustomEvent<{ id: string }>
}

export class MuteList extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _players: MutedPlayer[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    get players(): MutedPlayer[] {
        return this._players.slice()
    }
    set players(value: MutedPlayer[]) {
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
        if (this._players.length === 0) {
            this.innerHTML = `<div class="gc-mute-list-empty">No muted players.</div>`
            return
        }

        const rowsMarkup = this._players.map((p) => {
            const reason = p.reason ? `<span class="gc-mute-list-reason">${this.escape(p.reason)}</span>` : ''
            const mutedAt = p.mutedAt ? `<span class="gc-mute-list-time">${this.escape(p.mutedAt)}</span>` : ''
            return `<div role="listitem" class="gc-mute-list-row" data-id="${this.escape(p.id)}">
                <div class="gc-mute-list-text">
                    <span class="gc-mute-list-name">${this.escape(p.name)}</span>
                    ${reason}
                </div>
                ${mutedAt}
                <button type="button" class="gc-mute-list-unmute" data-action="unmute">Unmute</button>
            </div>`
        }).join('')

        this.innerHTML = rowsMarkup

        this.querySelectorAll<HTMLElement>('.gc-mute-list-unmute').forEach((el) => {
            el.addEventListener('click', () => {
                const row = el.closest('.gc-mute-list-row') as HTMLElement | null
                if (!row) return
                const id = row.dataset.id || ''
                this.emit('unmute', { id })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MuteList
    }
}
