import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/PartyPanel.scss'

export interface PartyMember {
    id: string
    name: string
    ready?: boolean
    host?: boolean
    role?: string
}

@customElement('gc-party-panel')
export class PartyPanel extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) members: PartyMember[] = []
    @property({ type: Number }) capacity = 4

    render() {
        const slots = Array.from({ length: this.capacity }, (_, i) => this.members[i] ?? null)
        return html`
            <div class="head">
                <strong>Party ${this.members.length}/${this.capacity}</strong>
                <button class="leave" @click=${() => this.emit('leave')}>Leave</button>
            </div>
            <ul>${slots.map((m) => m ? html`<li>
                <div class="avatar">👤</div>
                <div style="flex:1">
                    ${m.host ? html`<span class="host">★</span> ` : nothing}${m.name}
                    ${m.role ? html`<span class="role">${m.role}</span>` : nothing}
                </div>
                <div class="dot" style=${`background: ${m.ready ? 'var(--gc-success)' : 'rgba(255,255,255,0.2)'}`}></div>
            </li>` : html`<li><button class="empty" @click=${() => this.emit('invite')}>+ Invite friend</button></li>`)}</ul>`
    }
}
