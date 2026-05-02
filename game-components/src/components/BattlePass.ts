import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/BattlePass.scss'

export interface BattlePassTier {
    level: number
    xpRequired: number
    free?: { icon: string; label?: string; claimed?: boolean }
    premium?: { icon: string; label?: string; claimed?: boolean }
}

@customElement('gc-battle-pass')
export class BattlePass extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) tiers: BattlePassTier[] = []
    @property({ type: Number, attribute: 'current-level' }) currentLevel = 1
    @property({ type: Number, attribute: 'current-xp' }) currentXp = 0
    @property({ attribute: 'season-name' }) seasonName = 'Battle Pass'
    @property({ attribute: 'season-end' }) seasonEnd = ''
    @property({ type: Boolean, attribute: 'has-premium' }) hasPremium = false

    render() {
        const currentTier = this.tiers.find((tier) => tier.level === this.currentLevel)
        const xpPct = currentTier ? Math.min(1, this.currentXp / currentTier.xpRequired) : 0
        return html`
            <div class="head">
                <div>
                    <h2>${this.seasonName}</h2>
                    ${this.seasonEnd ? html`<div style="font-size:12px;opacity:0.6">Ends: ${this.seasonEnd}</div>` : nothing}
                </div>
                <div style="text-align:right">
                    <div class="level">${this.currentLevel}</div>
                    <div class="xp">${this.currentXp.toLocaleString()} / ${currentTier?.xpRequired.toLocaleString() ?? '—'} XP</div>
                </div>
            </div>
            <div class="xp-bar"><div class="xp-fill" style="width: ${xpPct * 100}%"></div></div>
            <div class="row">${this.tiers.map((tier) => {
                const reached = tier.level <= this.currentLevel
                return html`<div class="tier ${reached ? '' : 'locked'}">
                    <div class="tier-label">Lv ${tier.level}</div>
                    ${tier.premium ? html`<button class="premium ${tier.premium.claimed ? 'claimed' : ''}"
                        ?disabled=${!this.hasPremium || !reached || tier.premium.claimed}
                        @click=${() => this.emit('claim', { level: tier.level, track: 'premium' })}>
                        <div class="icon">${tier.premium.icon}</div>
                        ${tier.premium.label ? html`<div class="lb">${tier.premium.label}</div>` : nothing}
                        ${tier.premium.claimed ? html`<div class="ok">Claimed</div>` : nothing}
                    </button>` : nothing}
                    ${tier.free ? html`<button class="free ${tier.free.claimed ? 'claimed' : ''}"
                        ?disabled=${!reached || tier.free.claimed}
                        @click=${() => this.emit('claim', { level: tier.level, track: 'free' })}>
                        <div class="icon">${tier.free.icon}</div>
                        ${tier.free.label ? html`<div class="lb">${tier.free.label}</div>` : nothing}
                        ${tier.free.claimed ? html`<div class="ok">Claimed</div>` : nothing}
                    </button>` : nothing}
                </div>`
            })}</div>`
    }
}
