const TAG_NAME = 'tc-victory-screen'

// Port of game-components `gc-victory-screen` (a `gc-result-screen` whose
// defaults read "Victory!" / "Triumph" in a gold tone). The fantasy chrome
// (gilded frame, diamond divider, metal buttons, parchment fills) is dropped;
// this renders to the web-components design system — a flat slate region with a
// mono eyebrow, a status-toned title, a hairline divider, hairline-separated
// stat rows, a soft reward strip, and a row of `.btn` actions. All cosmetics
// flow through `--bs-victory-screen-*` custom properties.

export type VictoryScreenTitleColor = 'gold' | 'danger' | 'parch'
const TITLE_COLORS: VictoryScreenTitleColor[] = ['gold', 'danger', 'parch']

export type VictoryScreenActionVariant = 'default' | 'primary' | 'danger' | 'ghost'
const ACTION_VARIANTS: VictoryScreenActionVariant[] = ['default', 'primary', 'danger', 'ghost']

export interface VictoryStat {
    label: string
    value: string | number
}

export interface VictoryReward {
    label: string
    glyph?: string
    amount?: number | string
    color?: string
}

export interface VictoryAction {
    id: string
    label: string
    variant?: VictoryScreenActionVariant
}

export interface VictoryScreenEventMap {
    'tc-action': CustomEvent<{ id: string }>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

const ACTION_CLASS: Record<VictoryScreenActionVariant, string> = {
    default: 'btn btn-secondary',
    primary: 'btn btn-primary',
    danger: 'btn btn-danger',
    ghost: 'btn btn-outline-secondary',
}

export class VictoryScreen extends HTMLElement {

    private _initialised = false
    private _stats: VictoryStat[] = []
    private _rewards: VictoryReward[] = []
    private _actions: VictoryAction[] = []

    /** Optional callback fired alongside the `tc-action` CustomEvent. */
    onAction: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['title-text', 'subtitle', 'title-color', 'eyebrow']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
            this.render()
            this.addEventListener('click', this._onClick)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? 'Victory!'
    }
    set titleText(v: string) {
        if (v) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        if (v) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    get titleColor(): VictoryScreenTitleColor {
        const raw = this.getAttribute('title-color') as VictoryScreenTitleColor
        return TITLE_COLORS.includes(raw) ? raw : 'gold'
    }
    set titleColor(v: VictoryScreenTitleColor) {
        if (v) this.setAttribute('title-color', v)
        else this.removeAttribute('title-color')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Triumph'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get stats(): VictoryStat[] {
        return this._stats.slice()
    }
    set stats(v: VictoryStat[]) {
        this._stats = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get rewards(): VictoryReward[] {
        return this._rewards.slice()
    }
    set rewards(v: VictoryReward[]) {
        this._rewards = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get actions(): VictoryAction[] {
        return this._actions.slice()
    }
    set actions(v: VictoryAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _onClick = (e: MouseEvent): void => {
        if (!(e.target instanceof HTMLElement)) return
        const btn = e.target.closest<HTMLElement>('.tc-victory-screen-action')
        if (!btn || !this.contains(btn)) return
        const id = btn.dataset.id
        if (!id) return
        this.dispatchEvent(new CustomEvent('tc-action', { detail: { id }, bubbles: true, composed: true }))
        if (typeof this.onAction === 'function') this.onAction(id)
    }

    private formatValue(v: string | number): string {
        return typeof v === 'number' ? v.toLocaleString() : v
    }

    private render(): void {
        this.classList.add('tc-victory-screen')

        const statMarkup = this._stats.map(stat =>
            `<div class="tc-victory-screen-stat">`
            + `<span class="tc-victory-screen-stat-label">${esc(stat.label)}</span>`
            + `<span class="tc-victory-screen-stat-value">${esc(this.formatValue(stat.value))}</span>`
            + `</div>`
        ).join('')

        const rewardMarkup = this._rewards.map(reward => {
            const colorStyle = reward.color ? ` style="color: ${esc(reward.color)}"` : ''
            const glyphMarkup = reward.glyph
                ? `<span class="tc-victory-screen-reward-glyph"${colorStyle} aria-hidden="true">${esc(reward.glyph)}</span>`
                : ''
            const amountMarkup = reward.amount != null
                ? `<span class="tc-victory-screen-reward-amount">${esc(this.formatValue(reward.amount))}</span>`
                : ''
            return `<div class="tc-victory-screen-reward">`
                + glyphMarkup
                + `<span class="tc-victory-screen-reward-label">${esc(reward.label)}</span>`
                + amountMarkup
                + `</div>`
        }).join('')

        const actionMarkup = this._actions.map(action => {
            const variant = ACTION_VARIANTS.includes(action.variant as VictoryScreenActionVariant)
                ? (action.variant as VictoryScreenActionVariant)
                : 'default'
            return `<button type="button" class="tc-victory-screen-action ${ACTION_CLASS[variant]}" data-id="${esc(action.id)}">${esc(action.label)}</button>`
        }).join('')

        const subtitleMarkup = this.subtitle
            ? `<p class="tc-victory-screen-subtitle">${esc(this.subtitle)}</p>`
            : ''
        const statsBlock = statMarkup
            ? `<div class="tc-victory-screen-stats">${statMarkup}</div>`
            : ''
        const rewardsBlock = rewardMarkup
            ? `<div class="tc-victory-screen-rewards">`
                + `<span class="tc-victory-screen-rewards-eyebrow">Rewards</span>`
                + `<div class="tc-victory-screen-rewards-list">${rewardMarkup}</div>`
                + `</div>`
            : ''
        const actionsBlock = actionMarkup
            ? `<div class="tc-victory-screen-actions">${actionMarkup}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-victory-screen-root" data-title-color="${this.titleColor}">
                <span class="tc-victory-screen-eyebrow">${esc(this.eyebrow)}</span>
                <h2 class="tc-victory-screen-title">${esc(this.titleText)}</h2>
                <span class="tc-victory-screen-divider" aria-hidden="true"></span>
                ${subtitleMarkup}
                ${statsBlock}
                ${rewardsBlock}
                ${actionsBlock}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VictoryScreen
    }
}
