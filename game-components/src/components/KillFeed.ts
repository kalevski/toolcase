import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/KillFeed.styles.js'

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
    static styles = styles

    @property({ type: Array }) entries: KillFeedEntry[] = []
    @property({ type: Number, attribute: 'max-visible' }) maxVisible = 5

    render() {
        const visible = this.entries.slice(-this.maxVisible)
        return html`${visible.map((e) => html`<div class="entry">
            <span class="killer" style=${`color: ${e.killerColor ?? 'var(--gc-accent)'}`}>${e.killerName}</span>
            <span>${e.weapon ?? '→'}</span>
            ${e.headshot ? html`<span class="headshot" title="Headshot">★</span>` : nothing}
            <span class="victim" style=${`color: ${e.victimColor ?? 'var(--gc-danger)'}`}>${e.victimName}</span>
        </div>`)}`
    }
}
