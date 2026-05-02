const TAG_NAME = 'gc-battle-pass'

export interface BattlePassReward {
    label: string
    icon?: string
    claimed?: boolean
}

export interface BattlePassTier {
    level: number
    xpRequired: number
    free?: BattlePassReward
    premium?: BattlePassReward
}

export interface BattlePassEventMap {
    claim: CustomEvent<{ level: number, track: 'free' | 'premium' }>
}

export class BattlePass extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['current-level', 'current-xp', 'season-name', 'season-end', 'has-premium']
    }

    private _tiers: BattlePassTier[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    private numberAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get currentLevel(): number { return this.numberAttr('current-level', 1) }
    set currentLevel(v: number) { this.setAttribute('current-level', String(v)) }

    get currentXp(): number { return this.numberAttr('current-xp', 0) }
    set currentXp(v: number) { this.setAttribute('current-xp', String(v)) }

    get seasonName(): string { return this.getAttribute('season-name') ?? '' }
    set seasonName(v: string) {
        if (v) this.setAttribute('season-name', v)
        else this.removeAttribute('season-name')
    }

    get seasonEnd(): string { return this.getAttribute('season-end') ?? '' }
    set seasonEnd(v: string) {
        if (v) this.setAttribute('season-end', v)
        else this.removeAttribute('season-end')
    }

    get hasPremium(): boolean { return this.hasAttribute('has-premium') }
    set hasPremium(v: boolean) {
        if (v) this.setAttribute('has-premium', '')
        else this.removeAttribute('has-premium')
    }

    get tiers(): BattlePassTier[] {
        return this._tiers.slice()
    }
    set tiers(value: BattlePassTier[]) {
        this._tiers = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
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

    private renderRewardCell(level: number, track: 'free' | 'premium', reward: BattlePassReward | undefined, locked: boolean, gated: boolean): string {
        if (!reward) {
            return `<div class="gc-battle-pass-cell is-empty"></div>`
        }
        const stateCls = reward.claimed
            ? ' is-claimed'
            : (gated ? ' is-gated' : (locked ? ' is-locked' : ' is-claimable'))
        const cls = `gc-battle-pass-cell is-${track}${stateCls}`
        const lockGlyph = gated ? '🔒' : (locked ? '◇' : (reward.claimed ? '✓' : '◆'))
        const icon = reward.icon || lockGlyph
        return `<button type="button" class="${cls}" data-level="${level}" data-track="${track}" ${(reward.claimed || locked || gated) ? 'aria-disabled="true"' : ''}>
            <span class="gc-battle-pass-cell-icon">${this.escape(icon)}</span>
            <span class="gc-battle-pass-cell-label">${this.escape(reward.label)}</span>
        </button>`
    }

    private render(): void {
        const currentLevel = this.currentLevel
        const currentXp = this.currentXp
        const hasPremium = this.hasPremium
        const seasonName = this.seasonName
        const seasonEnd = this.seasonEnd

        const currentTier = this._tiers.find((t) => t.level === currentLevel)
        const xpRequired = currentTier?.xpRequired ?? 0
        const xpPct = xpRequired > 0 ? Math.max(0, Math.min(100, (currentXp / xpRequired) * 100)) : 0

        const tiersMarkup = this._tiers.map((tier) => {
            const locked = tier.level > currentLevel
            const gated = !hasPremium
            const isCurrent = tier.level === currentLevel
            const cls = `gc-battle-pass-tier${isCurrent ? ' is-current' : ''}${locked ? ' is-locked' : ''}`
            return `<div class="${cls}">
                ${this.renderRewardCell(tier.level, 'premium', tier.premium, locked, gated)}
                <div class="gc-battle-pass-tier-level">${tier.level}</div>
                ${this.renderRewardCell(tier.level, 'free', tier.free, locked, false)}
            </div>`
        }).join('')

        const headerParts: string[] = []
        if (seasonName) headerParts.push(`<gc-title class="gc-battle-pass-season">${this.escape(seasonName)}</gc-title>`)
        if (seasonEnd) headerParts.push(`<span class="gc-battle-pass-end">Ends ${this.escape(seasonEnd)}</span>`)

        this.innerHTML = `
            <div class="gc-battle-pass-header">
                <gc-eyebrow class="gc-battle-pass-eyebrow">Battle Pass</gc-eyebrow>
                ${headerParts.join('')}
                ${hasPremium ? '<span class="gc-battle-pass-premium-badge">Premium</span>' : ''}
            </div>
            <div class="gc-battle-pass-progress">
                <div class="gc-battle-pass-level">Level ${currentLevel}</div>
                <div class="gc-battle-pass-bar">
                    <div class="gc-battle-pass-bar-fill" style="width:${xpPct.toFixed(2)}%;"></div>
                </div>
                <div class="gc-battle-pass-xp">${currentXp.toLocaleString()} / ${xpRequired.toLocaleString()} XP</div>
            </div>
            <div class="gc-battle-pass-track">
                <div class="gc-battle-pass-track-labels">
                    <span class="gc-battle-pass-track-label">Premium</span>
                    <span class="gc-battle-pass-track-label">Free</span>
                </div>
                <div class="gc-battle-pass-tiers">${tiersMarkup}</div>
            </div>
        `

        this.querySelectorAll<HTMLButtonElement>('.gc-battle-pass-cell.is-claimable').forEach((el) => {
            el.addEventListener('click', () => {
                const level = parseInt(el.dataset.level || '0', 10)
                const track = (el.dataset.track === 'premium' ? 'premium' : 'free') as 'free' | 'premium'
                this.emit('claim', { level, track })
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, BattlePass)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BattlePass
    }
}
