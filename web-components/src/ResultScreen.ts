const TAG_NAME = 'tc-result-screen'

// Port of game-components `gc-result-screen`. The fantasy chrome (gilded frame,
// diamond divider, metal buttons) is dropped; this renders to the web-components
// design system — a flat slate region with a mono eyebrow, a status-toned title,
// a hairline divider, hairline-separated stat rows, a soft reward strip, and a
// row of `.btn` actions. All cosmetics flow through `--bs-result-screen-*` so
// themes can re-skin via vars alone.

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

export type ResultScreenTitleColor = 'gold' | 'danger' | 'parch'
const TITLE_COLORS: ResultScreenTitleColor[] = ['gold', 'danger', 'parch']

export type ResultScreenActionVariant = 'default' | 'primary' | 'danger' | 'ghost'
const ACTION_VARIANTS: ResultScreenActionVariant[] = ['default', 'primary', 'danger', 'ghost']

export interface ResultStat {
    label: string
    value: string | number
}

export interface ResultReward {
    label: string
    glyph?: string
    amount?: number | string
    color?: string
}

export interface ResultAction {
    id: string
    label: string
    variant?: ResultScreenActionVariant
}

export interface ResultScreenEventMap {
    'tc-action': CustomEvent<{ id: string }>
}

const ACTION_CLASS: Record<ResultScreenActionVariant, string> = {
    default: 'btn btn-secondary',
    primary: 'btn btn-primary',
    danger: 'btn btn-danger',
    ghost: 'btn btn-outline-secondary',
}

export class ResultScreen extends HTMLElement {

    private _initialised = false
    private _stats: ResultStat[] = []
    private _rewards: ResultReward[] = []
    private _actions: ResultAction[] = []

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
        return this.getAttribute('title-text') ?? ''
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

    get titleColor(): ResultScreenTitleColor {
        const raw = this.getAttribute('title-color') as ResultScreenTitleColor
        return TITLE_COLORS.includes(raw) ? raw : 'gold'
    }
    set titleColor(v: ResultScreenTitleColor) {
        if (v) this.setAttribute('title-color', v)
        else this.removeAttribute('title-color')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Result'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get stats(): ResultStat[] {
        return this._stats.slice()
    }
    set stats(v: ResultStat[]) {
        this._stats = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get rewards(): ResultReward[] {
        return this._rewards.slice()
    }
    set rewards(v: ResultReward[]) {
        this._rewards = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get actions(): ResultAction[] {
        return this._actions.slice()
    }
    set actions(v: ResultAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    private _onClick = (e: MouseEvent): void => {
        if (!(e.target instanceof HTMLElement)) return
        const btn = e.target.closest<HTMLElement>('.tc-result-screen-action')
        if (!btn || !this.contains(btn)) return
        const id = btn.dataset.id
        if (!id) return
        this.dispatchEvent(new CustomEvent('tc-action', { detail: { id }, bubbles: true, composed: true }))
        if (typeof this.onAction === 'function') this.onAction(id)
    }

    private _formatValue(v: string | number): string {
        return typeof v === 'number' ? v.toLocaleString() : v
    }

    private render(): void {
        this.classList.add('tc-result-screen')

        const statMarkup = this._stats.map(stat =>
            `<div class="tc-result-screen-stat">`
            + `<span class="tc-result-screen-stat-label">${esc(stat.label)}</span>`
            + `<span class="tc-result-screen-stat-value">${esc(this._formatValue(stat.value))}</span>`
            + `</div>`
        ).join('')

        const rewardMarkup = this._rewards.map(reward => {
            const colorStyle = reward.color ? ` style="color: ${esc(reward.color)}"` : ''
            const glyphMarkup = reward.glyph
                ? `<span class="tc-result-screen-reward-glyph"${colorStyle} aria-hidden="true">${esc(reward.glyph)}</span>`
                : ''
            const amountMarkup = reward.amount != null
                ? `<span class="tc-result-screen-reward-amount">${esc(this._formatValue(reward.amount))}</span>`
                : ''
            return `<div class="tc-result-screen-reward">`
                + glyphMarkup
                + `<span class="tc-result-screen-reward-label">${esc(reward.label)}</span>`
                + amountMarkup
                + `</div>`
        }).join('')

        const actionMarkup = this._actions.map(action => {
            const variant = ACTION_VARIANTS.includes(action.variant as ResultScreenActionVariant)
                ? (action.variant as ResultScreenActionVariant)
                : 'default'
            return `<button type="button" class="tc-result-screen-action ${ACTION_CLASS[variant]}" data-id="${esc(action.id)}">${esc(action.label)}</button>`
        }).join('')

        const subtitleMarkup = this.subtitle
            ? `<p class="tc-result-screen-subtitle">${esc(this.subtitle)}</p>`
            : ''
        const statsBlock = statMarkup
            ? `<div class="tc-result-screen-stats">${statMarkup}</div>`
            : ''
        const rewardsBlock = rewardMarkup
            ? `<div class="tc-result-screen-rewards">`
                + `<span class="tc-result-screen-rewards-eyebrow">Rewards</span>`
                + `<div class="tc-result-screen-rewards-list">${rewardMarkup}</div>`
                + `</div>`
            : ''
        const actionsBlock = actionMarkup
            ? `<div class="tc-result-screen-actions">${actionMarkup}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-result-screen-root" data-title-color="${this.titleColor}">
                <span class="tc-result-screen-eyebrow">${esc(this.eyebrow)}</span>
                <h2 class="tc-result-screen-title">${esc(this.titleText)}</h2>
                <span class="tc-result-screen-divider" aria-hidden="true"></span>
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
        [TAG_NAME]: ResultScreen
    }
}
