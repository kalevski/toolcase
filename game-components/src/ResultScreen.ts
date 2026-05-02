const TAG_NAME = 'gc-result-screen'

export type ResultScreenTitleColor = 'gold' | 'danger' | 'parch'

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
    variant?: 'default' | 'primary' | 'danger' | 'ghost'
}

export interface ResultScreenEventMap {
    action: CustomEvent<{ id: string }>
}

export class ResultScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['title-text', 'subtitle', 'title-color']
    }

    private _stats: ResultStat[] = []
    private _rewards: ResultReward[] = []
    private _actions: ResultAction[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? this.defaultTitleText()
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
        const raw = this.getAttribute('title-color')
        if (raw === 'danger' || raw === 'parch' || raw === 'gold') return raw
        return this.defaultTitleColor()
    }
    set titleColor(v: ResultScreenTitleColor) {
        if (v) this.setAttribute('title-color', v)
        else this.removeAttribute('title-color')
    }

    get stats(): ResultStat[] {
        return this._stats.slice()
    }
    set stats(v: ResultStat[]) {
        this._stats = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    get rewards(): ResultReward[] {
        return this._rewards.slice()
    }
    set rewards(v: ResultReward[]) {
        this._rewards = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    get actions(): ResultAction[] {
        return this._actions.slice()
    }
    set actions(v: ResultAction[]) {
        this._actions = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    protected defaultTitleText(): string {
        return ''
    }

    protected defaultTitleColor(): ResultScreenTitleColor {
        return 'gold'
    }

    protected eyebrowLabel(): string {
        return 'Result'
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private formatValue(v: string | number): string {
        if (typeof v === 'number') return v.toLocaleString()
        return v
    }

    private render(): void {
        const titleText = this.titleText
        const subtitle = this.subtitle
        const titleColor = this.titleColor

        const statMarkup = this._stats.map((stat) => {
            return `<div class="gc-result-screen-stat">
                <span class="gc-result-screen-stat-label">${this.escape(stat.label)}</span>
                <span class="gc-result-screen-stat-value">${this.escape(this.formatValue(stat.value))}</span>
            </div>`
        }).join('')

        const rewardMarkup = this._rewards.map((reward) => {
            const colorAttr = reward.color ? ` style="color: ${this.escape(reward.color)}"` : ''
            const glyphMarkup = reward.glyph ? `<span class="gc-result-screen-reward-glyph"${colorAttr}>${this.escape(reward.glyph)}</span>` : ''
            const amountMarkup = reward.amount != null
                ? `<span class="gc-result-screen-reward-amount">${this.escape(this.formatValue(reward.amount))}</span>`
                : ''
            return `<div class="gc-result-screen-reward">
                ${glyphMarkup}
                <span class="gc-result-screen-reward-label">${this.escape(reward.label)}</span>
                ${amountMarkup}
            </div>`
        }).join('')

        const actionMarkup = this._actions.map((action) => {
            const variant = action.variant || 'default'
            return `<gc-metal-button class="gc-result-screen-action" data-id="${this.escape(action.id)}" variant="${this.escape(variant)}">${this.escape(action.label)}</gc-metal-button>`
        }).join('')

        const subtitleMarkup = subtitle
            ? `<div class="gc-result-screen-subtitle">${this.escape(subtitle)}</div>`
            : ''

        const statsBlock = statMarkup
            ? `<div class="gc-result-screen-stats">${statMarkup}</div>`
            : ''
        const rewardsBlock = rewardMarkup
            ? `<div class="gc-result-screen-rewards">
                <gc-eyebrow class="gc-result-screen-rewards-eyebrow">Rewards</gc-eyebrow>
                <div class="gc-result-screen-rewards-list">${rewardMarkup}</div>
            </div>`
            : ''
        const actionsBlock = actionMarkup
            ? `<div class="gc-result-screen-actions">${actionMarkup}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-result-screen-root" data-title-color="${titleColor}">
                <gc-eyebrow class="gc-result-screen-eyebrow">${this.escape(this.eyebrowLabel())}</gc-eyebrow>
                <gc-title class="gc-result-screen-title">${this.escape(titleText)}</gc-title>
                <div class="gc-result-screen-divider"><span class="gc-result-screen-rule"></span><span class="gc-result-screen-diamond"></span><span class="gc-result-screen-rule"></span></div>
                ${subtitleMarkup}
                ${statsBlock}
                ${rewardsBlock}
                ${actionsBlock}
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-result-screen-action').forEach((el) => {
            el.addEventListener('click', () => {
                const id = el.dataset.id || ''
                if (!id) return
                this.emit('action', { id })
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResultScreen
    }
}
