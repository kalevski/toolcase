const TAG_NAME = 'tc-game-over-screen'

// Port of game-components `gc-game-over-screen` (a `gc-result-screen` whose
// defaults read "Game Over" / "Defeat" in a danger tone). The fantasy chrome
// (gilded frame, diamond divider, metal buttons) is dropped; this renders to
// the web-components design system — a flat slate region with a mono eyebrow, a
// status-toned title, a hairline divider, hairline-separated stat rows, a soft
// reward strip, and a row of `.btn` actions. All cosmetics flow through
// `--bs-game-over-screen-*` custom properties.

export type GameOverScreenTitleColor = 'gold' | 'danger' | 'parch'
const TITLE_COLORS: GameOverScreenTitleColor[] = ['gold', 'danger', 'parch']

export type GameOverScreenActionVariant = 'default' | 'primary' | 'danger' | 'ghost'
const ACTION_VARIANTS: GameOverScreenActionVariant[] = ['default', 'primary', 'danger', 'ghost']

export interface GameOverStat {
    label: string
    value: string | number
}

export interface GameOverReward {
    label: string
    glyph?: string
    amount?: number | string
    color?: string
}

export interface GameOverAction {
    id: string
    label: string
    variant?: GameOverScreenActionVariant
}

export interface GameOverScreenEventMap {
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

// `default`/`ghost` are toned-down per the design voice (slate, not colour);
// `primary` is the ink action; `danger` keeps the status colour.
const ACTION_CLASS: Record<GameOverScreenActionVariant, string> = {
    default: 'btn btn-secondary',
    primary: 'btn btn-primary',
    danger: 'btn btn-danger',
    ghost: 'btn btn-outline-secondary',
}

export class GameOverScreen extends HTMLElement {

    private _initialised = false
    private _stats: GameOverStat[] = []
    private _rewards: GameOverReward[] = []
    private _actions: GameOverAction[] = []

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
        return this.getAttribute('title-text') ?? 'Game Over'
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

    get titleColor(): GameOverScreenTitleColor {
        const raw = this.getAttribute('title-color') as GameOverScreenTitleColor
        return TITLE_COLORS.includes(raw) ? raw : 'danger'
    }
    set titleColor(v: GameOverScreenTitleColor) {
        if (v) this.setAttribute('title-color', v)
        else this.removeAttribute('title-color')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Defeat'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get stats(): GameOverStat[] {
        return this._stats.slice()
    }
    set stats(v: GameOverStat[]) {
        this._stats = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get rewards(): GameOverReward[] {
        return this._rewards.slice()
    }
    set rewards(v: GameOverReward[]) {
        this._rewards = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get actions(): GameOverAction[] {
        return this._actions.slice()
    }
    set actions(v: GameOverAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _onClick = (e: MouseEvent): void => {
        if (!(e.target instanceof HTMLElement)) return
        const btn = e.target.closest<HTMLElement>('.tc-game-over-screen-action')
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
        this.classList.add('tc-game-over-screen')

        const statMarkup = this._stats.map(stat =>
            `<div class="tc-game-over-screen-stat">`
            + `<span class="tc-game-over-screen-stat-label">${esc(stat.label)}</span>`
            + `<span class="tc-game-over-screen-stat-value">${esc(this.formatValue(stat.value))}</span>`
            + `</div>`
        ).join('')

        const rewardMarkup = this._rewards.map(reward => {
            const colorStyle = reward.color ? ` style="color: ${esc(reward.color)}"` : ''
            const glyphMarkup = reward.glyph
                ? `<span class="tc-game-over-screen-reward-glyph"${colorStyle} aria-hidden="true">${esc(reward.glyph)}</span>`
                : ''
            const amountMarkup = reward.amount != null
                ? `<span class="tc-game-over-screen-reward-amount">${esc(this.formatValue(reward.amount))}</span>`
                : ''
            return `<div class="tc-game-over-screen-reward">`
                + glyphMarkup
                + `<span class="tc-game-over-screen-reward-label">${esc(reward.label)}</span>`
                + amountMarkup
                + `</div>`
        }).join('')

        const actionMarkup = this._actions.map(action => {
            const variant = ACTION_VARIANTS.includes(action.variant as GameOverScreenActionVariant)
                ? (action.variant as GameOverScreenActionVariant)
                : 'default'
            return `<button type="button" class="tc-game-over-screen-action ${ACTION_CLASS[variant]}" data-id="${esc(action.id)}">${esc(action.label)}</button>`
        }).join('')

        const subtitleMarkup = this.subtitle
            ? `<p class="tc-game-over-screen-subtitle">${esc(this.subtitle)}</p>`
            : ''
        const statsBlock = statMarkup
            ? `<div class="tc-game-over-screen-stats">${statMarkup}</div>`
            : ''
        const rewardsBlock = rewardMarkup
            ? `<div class="tc-game-over-screen-rewards">`
                + `<span class="tc-game-over-screen-rewards-eyebrow">Rewards</span>`
                + `<div class="tc-game-over-screen-rewards-list">${rewardMarkup}</div>`
                + `</div>`
            : ''
        const actionsBlock = actionMarkup
            ? `<div class="tc-game-over-screen-actions">${actionMarkup}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-game-over-screen-root" data-title-color="${this.titleColor}">
                <span class="tc-game-over-screen-eyebrow">${esc(this.eyebrow)}</span>
                <h2 class="tc-game-over-screen-title">${esc(this.titleText)}</h2>
                <span class="tc-game-over-screen-divider" aria-hidden="true"></span>
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
        [TAG_NAME]: GameOverScreen
    }
}
