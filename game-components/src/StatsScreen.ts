const TAG_NAME = 'gc-stats-screen'

export interface StatsScreenStat {
    label: string
    value: string | number
}

export interface StatsSection {
    title: string
    stats: StatsScreenStat[]
}

export class StatsScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['screen-title', 'summary']
    }

    private _sections: StatsSection[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get screenTitle(): string {
        return this.getAttribute('screen-title') ?? 'Stats'
    }
    set screenTitle(v: string) {
        if (v) this.setAttribute('screen-title', v)
        else this.removeAttribute('screen-title')
    }

    get summary(): string {
        return this.getAttribute('summary') ?? ''
    }
    set summary(v: string) {
        if (v) this.setAttribute('summary', v)
        else this.removeAttribute('summary')
    }

    get sections(): StatsSection[] {
        return this._sections.slice()
    }
    set sections(v: StatsSection[]) {
        this._sections = Array.isArray(v) ? v.slice() : []
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

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private render(): void {
        const sectionsMarkup = this._sections.map((section) => {
            const statsMarkup = section.stats.map((stat) => {
                return `<div class="gc-stats-screen-stat">
                    <span class="gc-stats-screen-stat-label">${this.escape(stat.label)}</span>
                    <span class="gc-stats-screen-stat-value">${this.escape(this.formatValue(stat.value))}</span>
                </div>`
            }).join('')

            return `<section class="gc-stats-screen-section">
                <gc-eyebrow class="gc-stats-screen-section-title">${this.escape(section.title)}</gc-eyebrow>
                <div class="gc-stats-screen-section-stats">${statsMarkup}</div>
            </section>`
        }).join('')

        const summary = this.summary
        const summaryMarkup = summary
            ? `<div class="gc-stats-screen-summary">${this.escape(summary)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-stats-screen-root">
                <header class="gc-stats-screen-header">
                    <gc-eyebrow class="gc-stats-screen-eyebrow">Statistics</gc-eyebrow>
                    <gc-title class="gc-stats-screen-title">${this.escape(this.screenTitle)}</gc-title>
                    <div class="gc-stats-screen-divider"><span class="gc-stats-screen-rule"></span><span class="gc-stats-screen-diamond"></span><span class="gc-stats-screen-rule"></span></div>
                    ${summaryMarkup}
                </header>
                <div class="gc-stats-screen-sections">${sectionsMarkup}</div>
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, StatsScreen)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatsScreen
    }
}
