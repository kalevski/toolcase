import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-stat-row'

// Resolve a lucide icon by PascalCase key, return empty string when absent.

const trendUpIconHtml = icon(
    lucideByName('TrendingUp') || lucideByName('ArrowUp'),
    'tc-stat-row-trend-icon',
)
const trendDownIconHtml = icon(
    lucideByName('TrendingDown') || lucideByName('ArrowDown'),
    'tc-stat-row-trend-icon',
)

export class StatRow extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'value', 'accent', 'trend']
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

    private render(): void {
        const accent = this.accent
        if (accent) this.style.setProperty('--bs-stat-row-accent', accent)
        else this.style.removeProperty('--bs-stat-row-accent')

        // Format numeric string values with toLocaleString; pass through others.
        const rawValue = this.value
        const numeric = parseFloat(rawValue)
        const displayValue =
            Number.isFinite(numeric) && String(numeric) === rawValue
                ? numeric.toLocaleString()
                : rawValue

        const trend = this.trend
        let trendHtml = ''
        if (trend != null && trend !== 0) {
            const isUp = trend > 0
            const trendIcon = isUp ? trendUpIconHtml : trendDownIconHtml
            const modClass = isUp ? 'tc-stat-row-trend--up' : 'tc-stat-row-trend--down'
            const ariaLabel = isUp ? 'trending up' : 'trending down'
            const trendText = Math.abs(trend).toLocaleString()
            trendHtml = [
                `<span class="tc-stat-row-trend ${modClass}" aria-label="${ariaLabel} ${esc(trendText)}">`,
                trendIcon,
                `<span class="tc-stat-row-trend-text">${esc(trendText)}</span>`,
                '</span>',
            ].join('')
        }

        patchHtml(
            this,
            [
                '<div class="tc-stat-row">',
                `<span class="tc-stat-row-label">${esc(this.label)}</span>`,
                '<span class="tc-stat-row-right">',
                `<span class="tc-stat-row-value">${esc(displayValue)}</span>`,
                trendHtml,
                '</span>',
                '</div>',
            ].join(''),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatRow
    }
}
