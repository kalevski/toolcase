import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-kill-feed'

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
    private _initialised = false
    private _entries: KillFeedEntry[] = []

    static get observedAttributes(): string[] {
        return ['max-visible']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'log')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private render(): void {
        const visible = this._entries.slice(-this.maxVisible)

        const rowsHtml = visible
            .map((e) => {
                const killerStyle = e.killerColor
                    ? ` style="--bs-kill-feed-killer-color:${esc(e.killerColor)}"`
                    : ''
                const victimStyle = e.victimColor
                    ? ` style="--bs-kill-feed-victim-color:${esc(e.victimColor)}"`
                    : ''
                const weaponHtml = `<span class="tc-kill-feed-weapon">${e.weapon ? esc(e.weapon) : '⚔'}</span>`
                const headshotHtml = e.headshot
                    ? `<span class="tc-kill-feed-headshot" aria-label="headshot">✦</span>`
                    : ''
                const rowClass = e.headshot
                    ? 'tc-kill-feed-row tc-kill-feed-row--headshot'
                    : 'tc-kill-feed-row'
                return `<div class="${rowClass}" data-id="${esc(e.id)}"><span class="tc-kill-feed-killer"${killerStyle}>${esc(e.killerName)}</span>${weaponHtml}${headshotHtml}<span class="tc-kill-feed-victim"${victimStyle}>${esc(e.victimName)}</span></div>`
            })
            .join('')

        patchHtml(this, `<div class="tc-kill-feed">${rowsHtml}</div>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: KillFeed
    }
}
