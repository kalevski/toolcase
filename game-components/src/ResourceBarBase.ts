export abstract class ResourceBarBase extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'max', 'ghost', 'segments', 'show-text', 'label']
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

    get value(): number {
        const raw = this.getAttribute('value')
        if (raw == null) return 0
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? 0 : parsed
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get max(): number {
        const raw = this.getAttribute('max')
        if (raw == null) return 100
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? 100 : parsed
    }
    set max(v: number) {
        this.setAttribute('max', String(v))
    }

    get ghost(): number | null {
        const raw = this.getAttribute('ghost')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) ? null : parsed
    }
    set ghost(v: number | null) {
        if (v == null) this.removeAttribute('ghost')
        else this.setAttribute('ghost', String(v))
    }

    get segments(): number {
        const raw = this.getAttribute('segments')
        if (raw == null) return 1
        const parsed = parseInt(raw, 10)
        return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed
    }
    set segments(v: number) {
        this.setAttribute('segments', String(v))
    }

    get showText(): boolean {
        return this.hasAttribute('show-text')
    }
    set showText(v: boolean) {
        if (v) this.setAttribute('show-text', '')
        else this.removeAttribute('show-text')
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
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
        const max = this.max
        const value = Math.max(0, Math.min(max, this.value))
        const pct = (value / max) * 100
        const ghost = this.ghost
        const ghostPct = ghost != null ? Math.max(0, Math.min(max, ghost)) / max * 100 : 0
        const showGhost = ghost != null && ghostPct > pct
        const segments = this.segments
        const showText = this.showText
        const label = this.label

        const segmentDividers = segments > 1
            ? Array.from({ length: segments - 1 }, (_, i) => {
                const left = ((i + 1) / segments) * 100
                return `<div class="gc-bar-segment" style="left: ${left}%"></div>`
            }).join('')
            : ''

        const labelRow = label
            ? `<div class="gc-bar-label-row">
                <span class="gc-bar-label">${this.escape(label)}</span>
                <span class="gc-bar-label-value">${Math.round(value)} / ${Math.round(max)}</span>
            </div>`
            : ''

        const inlineText = showText && !label
            ? `<div class="gc-bar-inline-text">${Math.round(value)} / ${Math.round(max)}</div>`
            : ''

        const ghostMarkup = showGhost
            ? `<div class="gc-bar-ghost" style="width: ${ghostPct.toFixed(2)}%"></div>`
            : ''

        this.innerHTML = `
            ${labelRow}
            <div class="gc-bar-track">
                ${ghostMarkup}
                <div class="gc-bar-fill" style="width: ${pct.toFixed(2)}%"></div>
                <div class="gc-bar-scanlines"></div>
                ${segmentDividers}
                ${inlineText}
            </div>
        `
    }
}
