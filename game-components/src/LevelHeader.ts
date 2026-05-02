const TAG_NAME = 'gc-level-header'

export class LevelHeader extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['level', 'title', 'xp', 'xp-max', 'next-label']
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

    private numberAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get level(): number { return this.numberAttr('level', 1) }
    set level(v: number) { this.setAttribute('level', String(v)) }

    get title(): string { return this.getAttribute('title') ?? '' }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get xp(): number { return this.numberAttr('xp', 0) }
    set xp(v: number) { this.setAttribute('xp', String(v)) }

    get xpMax(): number { return this.numberAttr('xp-max', 100) }
    set xpMax(v: number) { this.setAttribute('xp-max', String(v)) }

    get nextLabel(): string { return this.getAttribute('next-label') ?? '' }
    set nextLabel(v: string) {
        if (v) this.setAttribute('next-label', v)
        else this.removeAttribute('next-label')
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
        const xp = this.xp
        const xpMax = Math.max(1, this.xpMax)
        const pct = Math.max(0, Math.min(100, (xp / xpMax) * 100))
        const nextMarkup = this.nextLabel
            ? `<span class="gc-level-header-next">Next: ${this.escape(this.nextLabel)}</span>`
            : ''
        const titleMarkup = this.title
            ? `<gc-title class="gc-level-header-title">${this.escape(this.title)}</gc-title>`
            : ''

        this.innerHTML = `
            <div class="gc-level-header-badge">
                <gc-eyebrow class="gc-level-header-eyebrow">Level</gc-eyebrow>
                <span class="gc-level-header-level">${this.level}</span>
            </div>
            <div class="gc-level-header-body">
                ${titleMarkup}
                <div class="gc-level-header-bar">
                    <div class="gc-level-header-bar-fill" style="width:${pct.toFixed(2)}%;"></div>
                </div>
                <div class="gc-level-header-bar-meta">
                    <span class="gc-level-header-xp">${Math.round(xp).toLocaleString()} / ${Math.round(xpMax).toLocaleString()} XP</span>
                    ${nextMarkup}
                </div>
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, LevelHeader)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LevelHeader
    }
}
