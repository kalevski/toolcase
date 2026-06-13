import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-tier-ladder'

export type TierColor = 'gray' | 'cyan' | 'yellow' | 'pink' | 'red'
const TIER_COLORS: TierColor[] = ['gray', 'cyan', 'yellow', 'pink', 'red']

export interface TierItem {
    id: string
    name: string
    range: string
    color?: TierColor
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr, 'tc-tier-ladder-current-icon')
}

const checkIconHtml = lucideByName('check')

export class TierLadder extends HTMLElement {
    private _initialised = false
    private _tiers: TierItem[] = []

    static get observedAttributes(): string[] {
        return ['title', 'current-tier-id', 'summary']
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

    get tiers(): TierItem[] {
        return this._tiers
    }
    set tiers(v: TierItem[]) {
        this._tiers = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get currentTierId(): string | null {
        return this.getAttribute('current-tier-id')
    }
    set currentTierId(v: string | null) {
        if (v != null) this.setAttribute('current-tier-id', v)
        else this.removeAttribute('current-tier-id')
    }

    get summary(): string | null {
        return this.getAttribute('summary')
    }
    set summary(v: string | null) {
        if (v != null) this.setAttribute('summary', v)
        else this.removeAttribute('summary')
    }

    private _tierRowHtml(tier: TierItem, isCurrent: boolean): string {
        const color: TierColor = TIER_COLORS.includes(tier.color as TierColor)
            ? (tier.color as TierColor)
            : 'gray'
        const currentClass = isCurrent ? ' tc-tier-ladder-tier--current' : ''
        const ariaCurrent = isCurrent ? ' aria-current="true"' : ''
        const currentIndicatorHtml = isCurrent
            ? `<span class="tc-tier-ladder-current-indicator" aria-label="Current tier">${checkIconHtml}</span>`
            : ''
        return (
            `<li class="tc-tier-ladder-tier${currentClass}"${ariaCurrent}>` +
            `<span class="tc-tier-ladder-dot tc-tier-ladder-dot--${color}" aria-hidden="true"></span>` +
            `<span class="tc-tier-ladder-name">${esc(tier.name)}</span>` +
            `<span class="tc-tier-ladder-range">${esc(tier.range)}</span>` +
            `${currentIndicatorHtml}` +
            `</li>`
        )
    }

    private render(): void {
        this.classList.add('tc-tier-ladder')

        const titleAttr = this.getAttribute('title')
        const titleHtml = titleAttr
            ? `<div class="tc-tier-ladder-title">${esc(titleAttr)}</div>`
            : ''

        const currentId = this.currentTierId

        let listHtml: string
        if (this._tiers.length === 0) {
            listHtml = `<ol class="tc-tier-ladder-list"><li class="tc-tier-ladder-empty">No tiers defined.</li></ol>`
        } else {
            const rowsHtml = this._tiers
                .map(tier => this._tierRowHtml(tier, tier.id === currentId))
                .join('')
            listHtml = `<ol class="tc-tier-ladder-list">${rowsHtml}</ol>`
        }

        const summaryAttr = this.getAttribute('summary')
        const summaryHtml = summaryAttr
            ? `<div class="tc-tier-ladder-summary">${esc(summaryAttr)}</div>`
            : ''

        this.innerHTML = `${titleHtml}${listHtml}${summaryHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TierLadder
    }
}
