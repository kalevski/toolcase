import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-result-screen'

// Port of game-components `gc-result-screen`. The fantasy chrome (gilded frame,
// diamond divider, metal buttons) is dropped; this renders to the web-components
// design system — a flat slate region with a mono eyebrow, a status-toned title,
// a hairline divider, hairline-separated stat rows, a soft reward strip, and a
// row of `.btn` actions. All cosmetics flow through `--bs-result-screen-*` so
// themes can re-skin via vars alone.
//
// The `variant` attribute (`neutral` | `defeat` | `victory`) seeds the
// title-text / title-color / eyebrow defaults; tc-game-over-screen (defeat) and
// tc-victory-screen (victory) are aliases that derive the variant from the tag
// name. Every seeded default is overridable via the matching attribute.

export type ResultScreenTitleColor = 'gold' | 'danger' | 'parch'
const TITLE_COLORS: ResultScreenTitleColor[] = ['gold', 'danger', 'parch']

export type ResultScreenActionVariant = 'default' | 'primary' | 'danger' | 'ghost'
const ACTION_VARIANTS: ResultScreenActionVariant[] = ['default', 'primary', 'danger', 'ghost']

export type ResultScreenVariant = 'neutral' | 'defeat' | 'victory'

interface VariantDefaults {
    titleText: string
    titleColor: ResultScreenTitleColor
    eyebrow: string
}

// Default title / color / eyebrow per variant. neutral is the bare result
// screen; defeat reads "Game Over" in danger; victory reads "Victory!" in gold.
const VARIANT_DEFAULTS: Record<ResultScreenVariant, VariantDefaults> = {
    neutral: { titleText: '', titleColor: 'gold', eyebrow: 'Result' },
    defeat: { titleText: 'Game Over', titleColor: 'danger', eyebrow: 'Defeat' },
    victory: { titleText: 'Victory!', titleColor: 'gold', eyebrow: 'Triumph' },
}

// Default variant per registered tag — the alias presets seed their variant from
// the tag they were defined as.
const TAG_VARIANTS: Record<string, ResultScreenVariant> = {
    'tc-game-over-screen': 'defeat',
    'tc-victory-screen': 'victory',
}

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
        return ['title-text', 'subtitle', 'title-color', 'eyebrow', 'variant']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): ResultScreenVariant {
        const raw = this.getAttribute('variant') as ResultScreenVariant
        if (raw && raw in VARIANT_DEFAULTS) return raw
        return TAG_VARIANTS[this.localName] ?? 'neutral'
    }
    set variant(v: ResultScreenVariant) {
        if (v) this.setAttribute('variant', v)
        else this.removeAttribute('variant')
    }

    private get variantDefaults(): VariantDefaults {
        return VARIANT_DEFAULTS[this.variant]
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? this.variantDefaults.titleText
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
        return TITLE_COLORS.includes(raw) ? raw : this.variantDefaults.titleColor
    }
    set titleColor(v: ResultScreenTitleColor) {
        if (v) this.setAttribute('title-color', v)
        else this.removeAttribute('title-color')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? this.variantDefaults.eyebrow
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
        this.dispatchEvent(
            new CustomEvent('tc-action', { detail: { id }, bubbles: true, composed: true }),
        )
        if (typeof this.onAction === 'function') this.onAction(id)
    }

    private _formatValue(v: string | number): string {
        return typeof v === 'number' ? v.toLocaleString() : v
    }

    private render(): void {
        this.classList.add('tc-result-screen')

        const statMarkup = this._stats
            .map(
                (stat) =>
                    `<div class="tc-result-screen-stat">` +
                    `<span class="tc-result-screen-stat-label">${esc(stat.label)}</span>` +
                    `<span class="tc-result-screen-stat-value">${esc(this._formatValue(stat.value))}</span>` +
                    `</div>`,
            )
            .join('')

        const rewardMarkup = this._rewards
            .map((reward) => {
                const colorStyle = reward.color ? ` style="color: ${esc(reward.color)}"` : ''
                const glyphMarkup = reward.glyph
                    ? `<span class="tc-result-screen-reward-glyph"${colorStyle} aria-hidden="true">${esc(reward.glyph)}</span>`
                    : ''
                const amountMarkup =
                    reward.amount != null
                        ? `<span class="tc-result-screen-reward-amount">${esc(this._formatValue(reward.amount))}</span>`
                        : ''
                return (
                    `<div class="tc-result-screen-reward">` +
                    glyphMarkup +
                    `<span class="tc-result-screen-reward-label">${esc(reward.label)}</span>` +
                    amountMarkup +
                    `</div>`
                )
            })
            .join('')

        const actionMarkup = this._actions
            .map((action) => {
                const variant = ACTION_VARIANTS.includes(
                    action.variant as ResultScreenActionVariant,
                )
                    ? (action.variant as ResultScreenActionVariant)
                    : 'default'
                return `<button type="button" class="tc-result-screen-action ${ACTION_CLASS[variant]}" data-id="${esc(action.id)}">${esc(action.label)}</button>`
            })
            .join('')

        const subtitleMarkup = this.subtitle
            ? `<p class="tc-result-screen-subtitle">${esc(this.subtitle)}</p>`
            : ''
        const statsBlock = statMarkup
            ? `<div class="tc-result-screen-stats">${statMarkup}</div>`
            : ''
        const rewardsBlock = rewardMarkup
            ? `<div class="tc-result-screen-rewards">` +
              `<span class="tc-result-screen-rewards-eyebrow">Rewards</span>` +
              `<div class="tc-result-screen-rewards-list">${rewardMarkup}</div>` +
              `</div>`
            : ''
        const actionsBlock = actionMarkup
            ? `<div class="tc-result-screen-actions">${actionMarkup}</div>`
            : ''

        patchHtml(
            this,
            `
            <div class="tc-result-screen-root" data-title-color="${this.titleColor}">
                <span class="tc-result-screen-eyebrow">${esc(this.eyebrow)}</span>
                <h2 class="tc-result-screen-title">${esc(this.titleText)}</h2>
                <span class="tc-result-screen-divider" aria-hidden="true"></span>
                ${subtitleMarkup}
                ${statsBlock}
                ${rewardsBlock}
                ${actionsBlock}
            </div>
        `,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResultScreen
        'tc-game-over-screen': ResultScreen
        'tc-victory-screen': ResultScreen
    }
}
