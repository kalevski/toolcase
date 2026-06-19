import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-stat-card'

export type StatCardDeltaKind = 'up' | 'down' | 'neutral'

const DELTA_KINDS: StatCardDeltaKind[] = ['up', 'down', 'neutral']

const DELTA_ICON_KEYS: Record<StatCardDeltaKind, string[]> = {
    up: ['TrendingUp', 'ArrowUp'],
    down: ['TrendingDown', 'ArrowDown'],
    neutral: ['Minus', 'ArrowRight'],
}

const DELTA_ARIA_LABELS: Record<StatCardDeltaKind, string> = {
    up: 'trending up',
    down: 'trending down',
    neutral: 'no change',
}

function resolveDeltaIcon(kind: StatCardDeltaKind): string {
    for (const k of DELTA_ICON_KEYS[kind]) {
        const svg = lucideByName(k)
        if (svg) return icon(svg, 'tc-stat-card-delta-icon')
    }
    return ''
}

function resolveIcon(name: string): string {
    const svg = lucideByName(name)
    return svg ? icon(svg, 'tc-stat-card-icon-svg') : ''
}

export class StatCard extends HTMLElement {
    private _initialised = false
    private _valueSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return [
            'icon',
            'label',
            'value',
            'unit',
            'delta',
            'delta-kind',
            'helper',
            'footer',
            'loading',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._valueSlotNodes = !this.hasAttribute('value') ? Array.from(this.childNodes) : []

            this.render()

            if (!this.hasAttribute('value')) {
                const valueEl = this.querySelector('.tc-stat-card-value')
                if (valueEl) this._valueSlotNodes.forEach((n) => valueEl.appendChild(n))
            }

            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        // Re-capture value slot nodes from their current inner container.
        if (!this.hasAttribute('value')) {
            const valueEl = this.querySelector('.tc-stat-card-value')
            if (valueEl) {
                this._valueSlotNodes = Array.from(valueEl.childNodes)
            }
        }

        this.render()

        if (!this.hasAttribute('value')) {
            const newValueEl = this.querySelector('.tc-stat-card-value')
            if (newValueEl) this._valueSlotNodes.forEach((n) => newValueEl.appendChild(n))
        }
    }

    // Note: 'icon' getter/setter is safe — HTMLElement does not expose an 'icon' property.
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(v: string) {
        this.setAttribute('label', v)
    }

    get value(): string | null {
        return this.getAttribute('value')
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get unit(): string | null {
        return this.getAttribute('unit')
    }
    set unit(v: string | null) {
        if (v != null) this.setAttribute('unit', v)
        else this.removeAttribute('unit')
    }

    get delta(): string | null {
        return this.getAttribute('delta')
    }
    set delta(v: string | null) {
        if (v != null) this.setAttribute('delta', v)
        else this.removeAttribute('delta')
    }

    get deltaKind(): StatCardDeltaKind {
        const v = this.getAttribute('delta-kind') as StatCardDeltaKind
        return DELTA_KINDS.includes(v) ? v : 'neutral'
    }
    set deltaKind(v: StatCardDeltaKind) {
        this.setAttribute('delta-kind', v)
    }

    get helper(): string | null {
        return this.getAttribute('helper')
    }
    set helper(v: string | null) {
        if (v != null) this.setAttribute('helper', v)
        else this.removeAttribute('helper')
    }

    get footer(): string | null {
        return this.getAttribute('footer')
    }
    set footer(v: string | null) {
        if (v != null) this.setAttribute('footer', v)
        else this.removeAttribute('footer')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private render(): void {
        const loading = this.loading

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="card tc-stat-card" aria-hidden="true">',
                '<div class="card-body tc-stat-card-body">',
                '<div class="tc-stat-card-skeleton tc-stat-card-skeleton--label"></div>',
                '<div class="tc-stat-card-skeleton tc-stat-card-skeleton--value"></div>',
                '<div class="tc-stat-card-skeleton tc-stat-card-skeleton--delta"></div>',
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
                '</div>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const iconName = this.getAttribute('icon')
        const label = this.getAttribute('label') ?? ''
        const value = this.getAttribute('value')
        const unit = this.getAttribute('unit')
        const delta = this.getAttribute('delta')
        const deltaKind = this.deltaKind
        const helper = this.getAttribute('helper')
        const footer = this.getAttribute('footer')

        // Icon tile
        const iconHtml = iconName
            ? `<span class="tc-stat-card-icon" aria-hidden="true">${resolveIcon(iconName)}</span>`
            : ''

        // Value row (attribute-driven content; slot children injected after render)
        const unitHtml = unit ? `<span class="tc-stat-card-unit">${esc(unit)}</span>` : ''
        const valueContent = value !== null ? esc(value) : ''
        const valueHtml = [
            '<div class="tc-stat-card-value-row">',
            `<span class="tc-stat-card-value">${valueContent}</span>`,
            unitHtml,
            '</div>',
        ].join('')

        // Delta
        const deltaHtml = delta
            ? [
                  `<span class="tc-stat-card-delta tc-stat-card-delta--${deltaKind}" aria-label="${esc(DELTA_ARIA_LABELS[deltaKind])} ${esc(delta)}">`,
                  resolveDeltaIcon(deltaKind),
                  `<span class="tc-stat-card-delta-text">${esc(delta)}</span>`,
                  '</span>',
              ].join('')
            : ''

        // Helper text
        const helperHtml = helper ? `<span class="tc-stat-card-helper">${esc(helper)}</span>` : ''

        // Footer
        const footerHtml = footer ? `<div class="tc-stat-card-footer">${esc(footer)}</div>` : ''

        this.innerHTML = [
            '<div class="card tc-stat-card">',
            '<div class="card-body tc-stat-card-body">',
            '<div class="tc-stat-card-header">',
            iconHtml,
            `<span class="tc-stat-card-label">${esc(label)}</span>`,
            '</div>',
            valueHtml,
            deltaHtml ? `<div class="tc-stat-card-delta-row">${deltaHtml}</div>` : '',
            helperHtml,
            '</div>',
            footerHtml ? `<div class="tc-stat-card-footer-row">${footerHtml}</div>` : '',
            '</div>',
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatCard
    }
}
