import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-stats-screen'

export interface StatsScreenStat {
    label: string
    value: string | number
}

export interface StatsSection {
    title: string
    stats: StatsScreenStat[]
}

export class StatsScreen extends HTMLElement {
    private _initialised = false
    private _sections: StatsSection[] = []

    static get observedAttributes(): string[] {
        return ['screen-title', 'summary']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private _formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private render(): void {
        const summary = this.summary

        const summaryMarkup = summary
            ? `<p class="tc-stats-screen-summary">${esc(summary)}</p>`
            : ''

        const sectionsMarkup = this._sections
            .map((section) => {
                const statsMarkup = section.stats
                    .map(
                        (stat) =>
                            `<div class="tc-stats-screen-stat">
                    <span class="tc-stats-screen-stat-label">${esc(stat.label)}</span>
                    <span class="tc-stats-screen-stat-value">${esc(this._formatValue(stat.value))}</span>
                </div>`,
                    )
                    .join('')

                return `<section class="tc-stats-screen-section">
                <div class="tc-stats-screen-section-title">${esc(section.title)}</div>
                <div class="tc-stats-screen-section-stats">${statsMarkup}</div>
            </section>`
            })
            .join('')

        patchHtml(
            this,
            `
            <div class="tc-stats-screen">
                <header class="tc-stats-screen-header">
                    <div class="tc-stats-screen-eyebrow">Statistics</div>
                    <div class="tc-stats-screen-title">${esc(this.screenTitle)}</div>
                    <div class="tc-stats-screen-separator" aria-hidden="true"></div>
                    ${summaryMarkup}
                </header>
                ${sectionsMarkup ? `<div class="tc-stats-screen-sections">${sectionsMarkup}</div>` : ''}
            </div>
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatsScreen
    }
}
