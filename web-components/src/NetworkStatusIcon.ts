const TAG_NAME = 'tc-network-status-icon'

export type NetworkStatusTier = 'offline' | 'bad' | 'warning' | 'ok' | 'good'

const TIER_LABELS: Record<NetworkStatusTier, string> = {
    offline: 'Offline',
    bad: 'Bad signal',
    warning: 'Poor signal',
    ok: 'Fair signal',
    good: 'Good signal',
}

export class NetworkStatusIcon extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['ping', 'loss', 'connected', 'size', 'show-label']
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

    get loss(): number {
        const raw = this.getAttribute('loss')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed
    }
    set loss(value: number) {
        this.setAttribute('loss', String(value))
    }

    get connected(): boolean {
        return this.hasAttribute('connected')
    }
    set connected(value: boolean) {
        if (value) this.setAttribute('connected', '')
        else this.removeAttribute('connected')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw == null) return 16
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 16 : parsed
    }
    set size(value: number) {
        this.setAttribute('size', String(value))
    }

    get showLabel(): boolean {
        return this.hasAttribute('show-label')
    }
    set showLabel(value: boolean) {
        if (value) this.setAttribute('show-label', '')
        else this.removeAttribute('show-label')
    }

    private _computeBars(): number {
        if (!this.connected) return 0
        const ping = this.ping
        const loss = this.loss
        const p = ping == null ? 999 : ping
        if (p >= 200 || loss >= 5) return 1
        if (p >= 120 || loss >= 3) return 2
        if (p >= 60 || loss >= 1) return 3
        return 4
    }

    private _computeTier(bars: number): NetworkStatusTier {
        if (bars === 0) return 'offline'
        if (bars === 1) return 'bad'
        if (bars === 2) return 'warning'
        if (bars === 3) return 'ok'
        return 'good'
    }

    private _computeLabelText(tier: NetworkStatusTier): string {
        if (tier === 'offline') return 'OFFLINE'
        const ping = this.ping
        if (ping == null) return 'ONLINE'
        return `${Math.round(ping)} ms`
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--bs-network-status-icon-size', `${size}px`)

        const bars = this._computeBars()
        const tier = this._computeTier(bars)

        this.dataset.tier = tier

        const barsHtml = [1, 2, 3, 4].map(i => {
            const active = i <= bars ? ' is-active' : ''
            return `<span class="tc-network-status-icon-bar${active}" data-step="${i}" aria-hidden="true"></span>`
        }).join('')

        const ariaLabel = TIER_LABELS[tier]
        const labelHtml = this.showLabel
            ? `<span class="tc-network-status-icon-label" aria-hidden="true">${this._computeLabelText(tier)}</span>`
            : ''

        this.innerHTML = `<span class="tc-network-status-icon" role="img" aria-label="${ariaLabel}"><span class="tc-network-status-icon-bars">${barsHtml}</span>${labelHtml}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NetworkStatusIcon
    }
}
