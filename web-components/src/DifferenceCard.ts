import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-difference-card'

const DIRECTION_ICONS: Record<string, string[]> = {
    up: ['TrendingUp', 'ArrowUp'],
    down: ['TrendingDown', 'ArrowDown'],
    neutral: ['Minus', 'ArrowRight'],
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function defaultFormat(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return v.toLocaleString()
}

function resolveDirectionIcon(direction: string): string {
    const keys = DIRECTION_ICONS[direction] ?? DIRECTION_ICONS.neutral
    for (const k of keys) {
        const svg = (LucideIcons as Record<string, string>)[k]
        if (svg) return icon(svg, 'tc-difference-card-delta-icon')
    }
    return ''
}

export class DifferenceCard extends HTMLElement {
    private _initialised = false
    private _formatValue: ((v: number) => string) | null = null

    static get observedAttributes(): string[] {
        return ['title', 'value', 'previous-value', 'period', 'loading']
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

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get value(): number {
        return parseFloat(this.getAttribute('value') ?? '0') || 0
    }
    set value(v: number) {
        this.setAttribute('value', String(v))
    }

    get previousValue(): number {
        return parseFloat(this.getAttribute('previous-value') ?? '0') || 0
    }
    set previousValue(v: number) {
        this.setAttribute('previous-value', String(v))
    }

    get period(): string | null {
        return this.getAttribute('period')
    }
    set period(v: string | null) {
        if (v != null) this.setAttribute('period', v)
        else this.removeAttribute('period')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get formatValue(): ((v: number) => string) | null {
        return this._formatValue
    }
    set formatValue(v: ((v: number) => string) | null) {
        this._formatValue = typeof v === 'function' ? v : null
        if (this._initialised) this.render()
    }

    private render(): void {
        if (this.loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="card tc-difference-card">',
                '<div class="card-body tc-difference-card-body">',
                '<div class="tc-difference-card-skeleton tc-difference-card-skeleton--title"></div>',
                '<div class="tc-difference-card-skeleton tc-difference-card-skeleton--value"></div>',
                '<div class="tc-difference-card-skeleton tc-difference-card-skeleton--delta"></div>',
                '<div class="tc-difference-card-skeleton tc-difference-card-skeleton--period"></div>',
                '<span class="visually-hidden" role="status">Loading…</span>',
                '</div>',
                '</div>',
            ].join('')
            return
        }

        this.removeAttribute('aria-busy')

        const val = this.value
        const prev = this.previousValue
        const fmt = typeof this._formatValue === 'function' ? this._formatValue : defaultFormat

        const formattedValue = esc(fmt(val))

        let deltaText: string
        let direction: string

        if (prev === 0) {
            deltaText = '—' // em-dash
            direction = 'neutral'
        } else {
            const diff = ((val - prev) / prev) * 100
            if (diff > 0) {
                direction = 'up'
                deltaText = `+${diff.toFixed(1)}%`
            } else if (diff < 0) {
                direction = 'down'
                deltaText = `${diff.toFixed(1)}%`
            } else {
                direction = 'neutral'
                deltaText = '0.0%'
            }
        }

        const deltaIcon = resolveDirectionIcon(direction)
        const period = this.getAttribute('period')
        const periodHtml = period
            ? `<span class="tc-difference-card-period">${esc(period)}</span>`
            : ''

        this.innerHTML = [
            '<div class="card tc-difference-card">',
            '<div class="card-body tc-difference-card-body">',
            `<span class="tc-difference-card-title">${esc(this.title)}</span>`,
            '<div class="tc-difference-card-metric">',
            `<span class="tc-difference-card-value">${formattedValue}</span>`,
            `<span class="tc-difference-card-delta tc-difference-card-delta--${direction}">`,
            `${deltaIcon}<span class="tc-difference-card-delta-text">${esc(deltaText)}</span>`,
            '</span>',
            '</div>',
            periodHtml,
            '</div>',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DifferenceCard
    }
}
