const TAG_NAME = 'gc-network-status-icon'

export type NetworkStatusTier = 'offline' | 'bad' | 'warning' | 'ok' | 'good'

export class NetworkStatusIcon extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['ping', 'loss', 'connected', 'size', 'show-label']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
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

    private computeBars(): number {
        if (!this.connected) return 0
        const ping = this.ping
        const loss = this.loss
        const p = ping == null ? 999 : ping
        if (p >= 200 || loss >= 5) return 1
        if (p >= 120 || loss >= 3) return 2
        if (p >= 60 || loss >= 1) return 3
        return 4
    }

    private computeTier(bars: number): NetworkStatusTier {
        if (bars === 0) return 'offline'
        if (bars === 1) return 'bad'
        if (bars === 2) return 'warning'
        if (bars === 3) return 'ok'
        return 'good'
    }

    private computeLabel(tier: NetworkStatusTier): string {
        if (tier === 'offline') return 'OFFLINE'
        const ping = this.ping
        if (ping == null) return 'ONLINE'
        return `${Math.round(ping)} ms`
    }

    private render(): void {
        const size = this.size
        this.style.setProperty('--gc-network-status-icon-size', `${size}px`)

        const bars = this.computeBars()
        const tier = this.computeTier(bars)
        this.dataset.tier = tier

        const barNodes: string[] = []
        for (let i = 1; i <= 4; i++) {
            const cls = i <= bars ? 'gc-network-status-icon-bar is-active' : 'gc-network-status-icon-bar'
            barNodes.push(`<span class="${cls}" data-step="${i}"></span>`)
        }

        const label = this.showLabel
            ? `<span class="gc-network-status-icon-label">${this.computeLabel(tier)}</span>`
            : ''

        this.innerHTML = `
            <span class="gc-network-status-icon-bars">${barNodes.join('')}</span>
            ${label}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, NetworkStatusIcon)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NetworkStatusIcon
    }
}
