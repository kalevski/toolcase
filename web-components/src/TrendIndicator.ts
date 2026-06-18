import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-trend-indicator'

export type TrendDirection = 'up' | 'down' | 'neutral'
export type TrendSize = 'small' | 'default' | 'large'

const DIRECTIONS: TrendDirection[] = ['up', 'down', 'neutral']
const SIZES: TrendSize[] = ['small', 'default', 'large']

const ICON_KEYS: Record<TrendDirection, string[]> = {
    up: ['TrendingUp', 'ArrowUp'],
    down: ['TrendingDown', 'ArrowDown'],
    neutral: ['Minus', 'ArrowRight'],
}

// `flat` is accepted as a synonym of `neutral` — the legacy tc-leaderboard-trend
// preset used `flat`, so the alias keeps working.
function normalizeDirection(d: string | null): TrendDirection | null {
    if (d === 'flat') return 'neutral'
    return DIRECTIONS.includes(d as TrendDirection) ? (d as TrendDirection) : null
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inferDirection(value: string): TrendDirection {
    const num = parseFloat(value)
    if (!isNaN(num)) {
        if (num > 0) return 'up'
        if (num < 0) return 'down'
        return 'neutral'
    }
    return 'neutral'
}

function resolveDirectionIcon(direction: TrendDirection): string {
    for (const k of ICON_KEYS[direction]) {
        const svg = (LucideIcons as Record<string, string>)[k]
        if (svg) return icon(svg, 'tc-trend-indicator-icon')
    }
    return ''
}

export class TrendIndicator extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'direction', 'size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture any light-DOM children so they survive the render — used as
            // the value content when no `value` attribute is set (rich markup).
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('value')) {
                const inner = this.querySelector('.tc-trend-indicator-value')
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-trend-indicator-value')
        const slotContent = !this.hasAttribute('value') && inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('value')) {
            const newInner = this.querySelector('.tc-trend-indicator-value')
            if (newInner) slotContent.forEach(n => newInner.appendChild(n))
        }
    }

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get direction(): TrendDirection | null {
        return normalizeDirection(this.getAttribute('direction'))
    }
    set direction(v: TrendDirection | null) {
        if (v != null) this.setAttribute('direction', v)
        else this.removeAttribute('direction')
    }

    get size(): TrendSize {
        const s = this.getAttribute('size') as TrendSize
        return SIZES.includes(s) ? s : 'default'
    }
    set size(v: TrendSize) {
        this.setAttribute('size', v)
    }

    private render(): void {
        const rawValue = this.getAttribute('value') ?? ''
        const size = this.size

        const direction: TrendDirection =
            normalizeDirection(this.getAttribute('direction')) ?? inferDirection(rawValue)

        this.setAttribute('aria-label', `trending ${direction} ${rawValue}`.trim())

        const iconHtml = resolveDirectionIcon(direction)
        const valueHtml = esc(rawValue)

        this.innerHTML = `<span class="tc-trend-indicator tc-trend-indicator--${direction} tc-trend-indicator--${size}">${iconHtml}<span class="tc-trend-indicator-value">${valueHtml}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TrendIndicator
        'tc-leaderboard-trend': TrendIndicator
    }
}
