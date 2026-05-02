import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/KillFeed.scss'

export interface KillFeedEntry {
    id: string
    killerName: string
    victimName: string
    killerColor?: string
    victimColor?: string
    weapon?: string
    headshot?: boolean
}

@customElement('gc-kill-feed')
export class KillFeed extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) entries: KillFeedEntry[] = []
    @property({ type: Number, attribute: 'max-visible' }) maxVisible = 5

    render() {
        const visible = this.entries.slice(-this.maxVisible)
        return html`${visible.map((e) => {
            const accent = e.killerColor ?? 'var(--fg-gold)'
            return html`<div class="entry" style="--gc-feed-accent: ${accent}">
                <span class="killer" style=${`color: ${e.killerColor ?? 'var(--fg-gold-bright)'}`}>${e.killerName}</span>
                <span class="weapon">${e.weapon ?? '⚔'}</span>
                ${e.headshot ? html`<span class="headshot" title="Headshot">✦</span>` : nothing}
                <span class="victim" style=${`color: ${e.victimColor ?? 'var(--fg-parch-3)'}`}>${e.victimName}</span>
            </div>`
        })}`
    }
}
