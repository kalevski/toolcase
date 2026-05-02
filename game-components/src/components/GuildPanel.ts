import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/GuildPanel.scss'

export interface GuildMember {
    id: string
    name: string
    rank?: string
    online?: boolean
    contribution?: number
}

@customElement('gc-guild-panel')
export class GuildPanel extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ attribute: 'guild-name' }) guildName = ''
    @property() tag = ''
    @property() motto = ''
    @property({ type: Array }) members: GuildMember[] = []
    @property({ type: Number }) level: number | null = null
    @property({ type: Number, attribute: 'member-cap' }) memberCap: number | null = null

    render() {
        return html`
            <div class="head">
                <div style="display:flex;align-items:baseline;gap:8px">
                    <h2>${this.tag ? `[${this.tag}] ` : ''}${this.guildName}</h2>
                    ${this.level !== null ? html`<span style="font-size:12px;color:var(--gc-gold)">Lv ${this.level}</span>` : nothing}
                </div>
                ${this.motto ? html`<div class="motto">${this.motto}</div>` : nothing}
                <div class="meta">Members: ${this.members.length}${this.memberCap !== null ? ` / ${this.memberCap}` : ''}</div>
            </div>
            <ul>${this.members.map((m) => html`<li>
                <span class="dot" style=${`background: ${m.online ? 'var(--gc-success)' : '#5a5f68'}`}></span>
                <span style="flex:1">${m.name}</span>
                ${m.rank ? html`<span style="font-size:11px;opacity:0.7">${m.rank}</span>` : nothing}
                ${m.contribution !== undefined ? html`<span style="font-size:11px;color:var(--gc-gold)">${m.contribution.toLocaleString()}</span>` : nothing}
            </li>`)}</ul>`
    }
}
