import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-leaderboard-trend'

export type LeaderboardTrendDirection = 'up' | 'down' | 'flat'

const DIRECTIONS: LeaderboardTrendDirection[] = ['up', 'down', 'flat']

const DIRECTION_ICONS: Record<LeaderboardTrendDirection, string[]> = {
    up: ['TrendingUp', 'ArrowUp'],
    down: ['TrendingDown', 'ArrowDown'],
    flat: ['Minus', 'ArrowRight'],
}

function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function resolveIcon(direction: LeaderboardTrendDirection): string {
    for (const k of DIRECTION_ICONS[direction]) {
        const svg = (LucideIcons as Record<string, string>)[k]
        if (svg) return icon(svg, 'tc-leaderboard-trend-icon')
    }
    return ''
}

export class LeaderboardTrend extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['value', 'direction']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            if (!this.hasAttribute('value')) {
                const inner = this.querySelector('.tc-leaderboard-trend-value')
                if (inner) slotContent.forEach(n => inner.appendChild(n))
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-leaderboard-trend-value')
        const slotContent = !this.hasAttribute('value') && inner ? Array.from(inner.childNodes) : []
        this.render()
        if (!this.hasAttribute('value')) {
            const newInner = this.querySelector('.tc-leaderboard-trend-value')
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

    get direction(): LeaderboardTrendDirection {
        const d = this.getAttribute('direction') as LeaderboardTrendDirection
        return DIRECTIONS.includes(d) ? d : 'flat'
    }
    set direction(v: LeaderboardTrendDirection) {
        this.setAttribute('direction', v)
    }

    private render(): void {
        const direction = this.direction
        const value = this.getAttribute('value')
        const iconHtml = resolveIcon(direction)
        const valueHtml = value != null ? esc(value) : ''

        this.innerHTML = `<span class="tc-leaderboard-trend tc-leaderboard-trend-${direction}">${iconHtml}<span class="tc-leaderboard-trend-value">${valueHtml}</span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LeaderboardTrend
    }
}
