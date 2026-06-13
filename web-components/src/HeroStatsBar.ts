const TAG_NAME = 'tc-hero-stats-bar'

export interface HeroStat {
    label: string
    value: string | number
    unit?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function isZero(v: string | number | null | undefined): boolean {
    return v === null || v === undefined || v === '' || v === 0 || v === '0'
}

export class HeroStatsBar extends HTMLElement {
    private _initialised = false
    private _stats: HeroStat[] = []

    static get observedAttributes(): string[] {
        return ['class-name']
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

    get stats(): HeroStat[] {
        return this._stats
    }
    set stats(v: HeroStat[]) {
        this._stats = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const extraClass = this.getAttribute('class-name')
        const wrapperClass = extraClass
            ? `tc-hero-stats-bar ${esc(extraClass)}`
            : 'tc-hero-stats-bar'

        const items = this._stats.map(stat => {
            const v = stat.value as string | number | null | undefined
            const zero = isZero(v)
            const zeroMod = zero ? ' tc-hero-stats-bar-item--zero' : ''
            const displayValue = v == null || v === ''
                ? '—'
                : esc(String(v))
            const unitHtml = stat.unit
                ? `<span class="tc-hero-stats-bar-unit">${esc(String(stat.unit))}</span>`
                : ''
            return (
                `<div class="tc-hero-stats-bar-item${zeroMod}">` +
                `<div class="tc-hero-stats-bar-value">${displayValue}${unitHtml}</div>` +
                `<div class="tc-hero-stats-bar-label">${esc(stat.label)}</div>` +
                `</div>`
            )
        }).join('')

        this.innerHTML = `<div class="${wrapperClass}">${items}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: HeroStatsBar
    }
}
