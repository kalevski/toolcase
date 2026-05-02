const TAG_NAME = 'gc-boss-bar'

export class BossBar extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['name', 'epithet', 'phase', 'hp', 'hp-max']
    }

    private _phaseTicks: number[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        this.setAttribute('name', v)
    }

    get epithet(): string {
        return this.getAttribute('epithet') ?? ''
    }
    set epithet(v: string) {
        this.setAttribute('epithet', v)
    }

    get phase(): number {
        const raw = this.getAttribute('phase')
        if (raw == null) return 1
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) ? 1 : parsed
    }
    set phase(v: number) {
        this.setAttribute('phase', String(v))
    }

    get hp(): number {
        const raw = this.getAttribute('hp')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set hp(v: number) {
        this.setAttribute('hp', String(v))
    }

    get hpMax(): number {
        const raw = this.getAttribute('hp-max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 100 : parsed
    }
    set hpMax(v: number) {
        this.setAttribute('hp-max', String(v))
    }

    get phaseTicks(): number[] {
        return this._phaseTicks.slice()
    }
    set phaseTicks(values: number[]) {
        this._phaseTicks = Array.isArray(values) ? values.slice() : []
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
        const name = this.name
        const epithet = this.epithet
        const phase = this.phase
        const hp = this.hp
        const hpMax = this.hpMax
        const pct = Math.max(0, Math.min(100, (hp / hpMax) * 100))

        const ticks = this._phaseTicks
            .filter(t => t > 0 && t < 1)
            .map(t => `<div class="gc-boss-bar-tick" style="left: ${(t * 100).toFixed(2)}%"></div>`)
            .join('')

        const epithetMarkup = epithet ? `<span class="gc-boss-bar-epithet">${this.escape(epithet)}</span>` : ''

        this.innerHTML = `
            <div class="gc-boss-bar-header">
                <span class="gc-boss-bar-name">${this.escape(name)}</span>
                ${epithetMarkup}
                <span class="gc-boss-bar-phase">Phase ${phase}</span>
            </div>
            <div class="gc-boss-bar-track">
                <div class="gc-boss-bar-fill" style="width: ${pct.toFixed(2)}%"></div>
                <div class="gc-boss-bar-scanlines"></div>
                ${ticks}
            </div>
            <div class="gc-boss-bar-numeric">${Math.round(hp)} / ${Math.round(hpMax)}</div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, BossBar)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BossBar
    }
}
