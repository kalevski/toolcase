import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/MuteList.scss'

export interface MutedPlayer { id: string; name: string; mutedAt?: string; reason?: string }

@customElement('gc-mute-list')
export class MuteList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) players: MutedPlayer[] = []

    render() {
        if (this.players.length === 0) return html`<div class="empty">No muted players</div>`
        return html`<ul>${this.players.map((p) => html`<li>
            <span style="flex:1">${p.name}${p.reason ? html`<span style="font-size:11px;opacity:0.6;margin-left:6px">(${p.reason})</span>` : nothing}</span>
            ${p.mutedAt ? html`<span style="font-size:11px;opacity:0.5">${p.mutedAt}</span>` : nothing}
            <button @click=${() => this.emit('unmute', { id: p.id })}>Unmute</button>
        </li>`)}</ul>`
    }
}
