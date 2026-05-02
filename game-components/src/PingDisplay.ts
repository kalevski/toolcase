const TAG_NAME = 'gc-ping-display'

export type PingTier = 'unknown' | 'success' | 'warning' | 'danger'

export class PingDisplay extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['ping']
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
        if (this.isConnected) {
            this.render()
        }
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

    private classify(value: number | null): PingTier {
        if (value == null) return 'unknown'
        if (value < 60) return 'success'
        if (value < 200) return 'warning'
        return 'danger'
    }

    private render(): void {
        const value = this.ping
        const tier = this.classify(value)
        this.setAttribute('data-tier', tier)

        const text = value == null ? '—' : `${Math.round(value)} ms`
        this.innerHTML = `
            <span class="gc-ping-display-pip"></span>
            <span class="gc-ping-display-value">${this.escape(text)}</span>
        `
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PingDisplay)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PingDisplay
    }
}
