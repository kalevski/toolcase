import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-ping-display'

export type PingTier = 'unknown' | 'success' | 'warning' | 'danger'

export class PingDisplay extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['ping']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get ping(): number | null {
        const raw = this.getAttribute('ping')
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set ping(value: number | null) {
        if (value == null) this.removeAttribute('ping')
        else this.setAttribute('ping', String(value))
    }

    private _classify(value: number | null): PingTier {
        if (value == null) return 'unknown'
        if (value < 60) return 'success'
        if (value < 200) return 'warning'
        return 'danger'
    }

    private render(): void {
        const value = this.ping
        const tier = this._classify(value)

        this.dataset.tier = tier

        const text = value == null ? '—' : `${Math.round(value)} ms`

        patchHtml(
            this,
            `
            <span class="tc-ping-display-pip" aria-hidden="true"></span>
            <span class="tc-ping-display-value">${esc(text)}</span>
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PingDisplay
    }
}
