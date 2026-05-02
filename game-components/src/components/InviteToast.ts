import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/InviteToast.styles.js'

@customElement('gc-invite-toast')
export class InviteToast extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) open = false
    @property() inviter = ''
    @property() body = 'Invited you to a party'
    @property({ type: Number, attribute: 'timeout-seconds' }) timeoutSeconds = 0

    @state() private _remaining = 0
    private _timer = 0

    updated(changed: Map<string, unknown>): void {
        if (changed.has('open') || changed.has('timeoutSeconds')) {
            if (this._timer) { window.clearInterval(this._timer); this._timer = 0 }
            if (this.open && this.timeoutSeconds > 0) {
                this._remaining = this.timeoutSeconds
                this._timer = window.setInterval(() => {
                    this._remaining = Math.max(0, this._remaining - 1)
                    if (this._remaining === 0) { window.clearInterval(this._timer); this.emit('decline') }
                }, 1000)
            }
        }
    }

    render() {
        if (!this.open) return nothing
        return html`
            <div class="head">
                <div class="avatar">👤</div>
                <div style="flex:1">
                    <strong>${this.inviter}</strong>
                    <div class="body-text">${this.body}</div>
                </div>
                ${this._remaining > 0 ? html`<div style="font-size:11px;opacity:0.7">${this._remaining}s</div>` : nothing}
            </div>
            <div class="actions">
                <button class="accept" @click=${() => this.emit('accept')}>Accept</button>
                <button class="decline" @click=${() => this.emit('decline')}>Decline</button>
            </div>`
    }
}
