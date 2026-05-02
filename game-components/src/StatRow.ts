const TAG_NAME = 'gc-stat-row'

export class StatRow extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['label', 'value', 'accent', 'trend']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        if (v) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string | number) {
        const text = typeof v === 'number' ? String(v) : v
        if (text) this.setAttribute('value', text)
        else this.removeAttribute('value')
    }

    get accent(): string {
        return this.getAttribute('accent') ?? ''
    }
    set accent(v: string) {
        if (v) this.setAttribute('accent', v)
        else this.removeAttribute('accent')
    }

    get trend(): number | null {
        const raw = this.getAttribute('trend')
        if (raw == null || raw === '') return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set trend(v: number | null) {
        if (v == null) this.removeAttribute('trend')
        else this.setAttribute('trend', String(v))
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
        const accent = this.accent
        if (accent) this.style.setProperty('--gc-stat-row-accent', accent)
        else this.style.removeProperty('--gc-stat-row-accent')

        const trend = this.trend
        let trendMarkup = ''
        if (trend != null && trend !== 0) {
            const isUp = trend > 0
            const cls = `gc-stat-row-trend is-${isUp ? 'up' : 'down'}`
            const glyph = isUp ? '▲' : '▼'
            const formatted = Math.abs(trend).toLocaleString()
            trendMarkup = `<span class="${cls}">${glyph} ${formatted}</span>`
        }

        const formattedValue = this.value
        const numeric = parseFloat(formattedValue)
        const valueText = Number.isFinite(numeric) && String(numeric) === formattedValue
            ? numeric.toLocaleString()
            : formattedValue

        this.innerHTML = `
            <span class="gc-stat-row-label">${this.escape(this.label)}</span>
            <span class="gc-stat-row-value">${this.escape(valueText)}</span>
            ${trendMarkup}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, StatRow)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatRow
    }
}
