const TAG_NAME = 'gc-kill-feed'

export interface KillFeedEntry {
    id: string
    killerName: string
    victimName: string
    killerColor?: string
    victimColor?: string
    weapon?: string
    headshot?: boolean
}

export class KillFeed extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['max-visible']
    }

    private _entries: KillFeedEntry[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'log')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get maxVisible(): number {
        const raw = this.getAttribute('max-visible')
        if (raw == null) return 5
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 5
    }
    set maxVisible(v: number) {
        this.setAttribute('max-visible', String(v))
    }

    get entries(): KillFeedEntry[] {
        return this._entries.slice()
    }
    set entries(value: KillFeedEntry[]) {
        this._entries = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
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
        const visible = this._entries.slice(-this.maxVisible)
        const rowsMarkup = visible.map((e) => {
            const killerColor = e.killerColor ? `style="--gc-kill-feed-killer-color:${this.escape(e.killerColor)};"` : ''
            const victimColor = e.victimColor ? `style="--gc-kill-feed-victim-color:${this.escape(e.victimColor)};"` : ''
            const weaponMarkup = e.weapon
                ? `<span class="gc-kill-feed-weapon">${this.escape(e.weapon)}</span>`
                : `<span class="gc-kill-feed-weapon">⚔</span>`
            const headshotMarkup = e.headshot
                ? `<span class="gc-kill-feed-headshot" title="Headshot">✦</span>`
                : ''
            return `<div class="gc-kill-feed-row" data-id="${this.escape(e.id)}">
                <span class="gc-kill-feed-killer" ${killerColor}>${this.escape(e.killerName)}</span>
                ${weaponMarkup}
                ${headshotMarkup}
                <span class="gc-kill-feed-victim" ${victimColor}>${this.escape(e.victimName)}</span>
            </div>`
        }).join('')

        this.innerHTML = rowsMarkup
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: KillFeed
    }
}
