import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-battle-pass'

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
    'tc-claim': CustomEvent<{ level: number; track: 'free' | 'premium' }>
}

// State glyphs (resolved once) — lucide inline SVG, never unicode/emoji. The
// game-components original used unicode/emoji lock glyphs; the toolcase design
// system mandates inline SVG that recolors with state.
const claimableIconHtml = lucideByName('gift')
const claimedIconHtml = lucideByName('check')
const lockedIconHtml = lucideByName('lock')

const fmt = new Intl.NumberFormat('en')

export class BattlePass extends HTMLElement {
    private _initialised = false
    private _tiers: BattlePassTier[] = []

    // Optional callback property — fired alongside the `tc-claim` CustomEvent.
    onClaim: ((detail: { level: number; track: 'free' | 'premium' }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['current-level', 'current-xp', 'season-name', 'season-end', 'has-premium']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    private numberAttr(name: string, fallback: number): number {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get currentLevel(): number {
        return this.numberAttr('current-level', 1)
    }
    set currentLevel(v: number) {
        this.setAttribute('current-level', String(v))
    }

    get currentXp(): number {
        return this.numberAttr('current-xp', 0)
    }
    set currentXp(v: number) {
        this.setAttribute('current-xp', String(v))
    }

    get seasonName(): string {
        return this.getAttribute('season-name') ?? ''
    }
    set seasonName(v: string) {
        if (v) this.setAttribute('season-name', v)
        else this.removeAttribute('season-name')
    }

    get seasonEnd(): string {
        return this.getAttribute('season-end') ?? ''
    }
    set seasonEnd(v: string) {
        if (v) this.setAttribute('season-end', v)
        else this.removeAttribute('season-end')
    }

    get hasPremium(): boolean {
        return this.hasAttribute('has-premium')
    }
    set hasPremium(v: boolean) {
        if (v) this.setAttribute('has-premium', '')
        else this.removeAttribute('has-premium')
    }

    get tiers(): BattlePassTier[] {
        return this._tiers.slice()
    }
    set tiers(value: BattlePassTier[]) {
        this._tiers = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private emitClaim(level: number, track: 'free' | 'premium'): void {
        const detail = { level, track }
        this.dispatchEvent(new CustomEvent('tc-claim', { detail, bubbles: true, composed: true }))
        if (typeof this.onClaim === 'function') this.onClaim(detail)
    }

    private renderRewardCell(
        level: number,
        track: 'free' | 'premium',
        reward: BattlePassReward | undefined,
        locked: boolean,
        gated: boolean,
    ): string {
        if (!reward) {
            return `<div class="tc-battle-pass-cell is-empty" aria-hidden="true"></div>`
        }
        const state = reward.claimed
            ? 'is-claimed'
            : gated
              ? 'is-gated'
              : locked
                ? 'is-locked'
                : 'is-claimable'
        const claimable = state === 'is-claimable'
        const cls = `tc-battle-pass-cell is-${track} ${state}`
        const glyph = reward.claimed
            ? claimedIconHtml
            : gated || locked
              ? lockedIconHtml
              : claimableIconHtml
        const customIcon = reward.icon ? lucideByName(reward.icon) : ''
        const iconHtml = customIcon || glyph
        return `<button type="button" class="${cls}" data-level="${level}" data-track="${track}"${claimable ? '' : ' disabled'}>
            <span class="tc-battle-pass-cell-icon" aria-hidden="true">${iconHtml}</span>
            <span class="tc-battle-pass-cell-label">${esc(reward.label)}</span>
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
        const xpPct =
            xpRequired > 0 ? Math.max(0, Math.min(100, (currentXp / xpRequired) * 100)) : 0

        const tiersMarkup = this._tiers
            .map((tier) => {
                const locked = tier.level > currentLevel
                const gated = !hasPremium
                const isCurrent = tier.level === currentLevel
                const cls = `tc-battle-pass-tier${isCurrent ? ' is-current' : ''}${locked ? ' is-locked' : ''}`
                return `<div class="${cls}">
                    ${this.renderRewardCell(tier.level, 'premium', tier.premium, locked, gated)}
                    <div class="tc-battle-pass-tier-level">${tier.level}</div>
                    ${this.renderRewardCell(tier.level, 'free', tier.free, locked, false)}
                </div>`
            })
            .join('')

        const headerParts: string[] = []
        if (seasonName) {
            headerParts.push(`<h3 class="tc-battle-pass-season">${esc(seasonName)}</h3>`)
        }
        if (seasonEnd) {
            headerParts.push(`<span class="tc-battle-pass-end">Ends ${esc(seasonEnd)}</span>`)
        }

        const xpPctRounded = Math.round(xpPct)

        this.innerHTML = `
            <div class="tc-battle-pass">
                <div class="tc-battle-pass-header">
                    <span class="tc-battle-pass-eyebrow">Battle Pass</span>
                    ${headerParts.join('')}
                    ${hasPremium ? '<span class="tc-battle-pass-premium-badge">Premium</span>' : ''}
                </div>
                <div class="tc-battle-pass-progress">
                    <div class="tc-battle-pass-level">Level ${esc(String(currentLevel))}</div>
                    <div class="tc-battle-pass-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${xpPctRounded}">
                        <div class="tc-battle-pass-bar-fill" style="width:${xpPct.toFixed(2)}%;"></div>
                    </div>
                    <div class="tc-battle-pass-xp">${esc(fmt.format(currentXp))} / ${esc(fmt.format(xpRequired))} XP</div>
                </div>
                <div class="tc-battle-pass-track">
                    <div class="tc-battle-pass-track-labels">
                        <span class="tc-battle-pass-track-label">Premium</span>
                        <span class="tc-battle-pass-track-label">Free</span>
                    </div>
                    <div class="tc-battle-pass-tiers">${tiersMarkup}</div>
                </div>
            </div>
        `

        this.querySelectorAll<HTMLButtonElement>('.tc-battle-pass-cell.is-claimable').forEach(
            (el) => {
                el.addEventListener('click', () => {
                    const level = parseInt(el.dataset.level || '0', 10)
                    const track = (el.dataset.track === 'premium' ? 'premium' : 'free') as
                        | 'free'
                        | 'premium'
                    this.emitClaim(level, track)
                })
            },
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BattlePass
    }
}
