const TAG_NAME = 'tc-mute-list'

export interface MutedPlayer {
    id: string
    name: string
    mutedAt?: string
    reason?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class MuteList extends HTMLElement {
    private _initialised = false
    private _players: MutedPlayer[] = []

    onUnmute: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get players(): MutedPlayer[] {
        return this._players.slice()
    }
    set players(value: MutedPlayer[]) {
        this._players = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private render(): void {
        if (this._players.length === 0) {
            this.innerHTML = `<div class="tc-mute-list"><p class="tc-mute-list-empty">No muted players.</p></div>`
            return
        }

        const rowsHtml = this._players.map(p => {
            const reasonHtml = p.reason
                ? `<span class="tc-mute-list-reason">${esc(p.reason)}</span>`
                : ''
            const mutedAtHtml = p.mutedAt
                ? `<span class="tc-mute-list-time">${esc(p.mutedAt)}</span>`
                : ''
            return `<div role="listitem" class="tc-mute-list-row" data-id="${esc(p.id)}">
                <div class="tc-mute-list-text">
                    <span class="tc-mute-list-name">${esc(p.name)}</span>
                    ${reasonHtml}
                </div>
                <div class="tc-mute-list-meta">
                    ${mutedAtHtml}
                    <button type="button" class="tc-mute-list-unmute" data-action="unmute">Unmute</button>
                </div>
            </div>`
        }).join('')

        this.innerHTML = `<div class="tc-mute-list" role="list">${rowsHtml}</div>`

        const container = this.querySelector<HTMLElement>('.tc-mute-list')
        if (container) {
            container.addEventListener('click', (e: Event) => {
                const btn = (e.target as Element).closest<HTMLButtonElement>('[data-action="unmute"]')
                if (!btn || btn.disabled) return
                const row = btn.closest<HTMLElement>('.tc-mute-list-row')
                if (!row) return
                const id = row.dataset.id ?? ''
                this.dispatchEvent(new CustomEvent('tc-unmute', {
                    bubbles: true,
                    composed: true,
                    detail: { id },
                }))
                if (typeof this.onUnmute === 'function') this.onUnmute(id)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MuteList
    }
}
