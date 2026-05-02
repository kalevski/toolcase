import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ReportPlayerDialog.scss'

const DEFAULT_REASONS = [
    { id: 'cheating', label: 'Cheating' },
    { id: 'harassment', label: 'Harassment' },
    { id: 'griefing', label: 'Griefing' },
    { id: 'inappropriate-name', label: 'Inappropriate name' },
    { id: 'other', label: 'Other' },
]

@customElement('gc-report-player-dialog')
export class ReportPlayerDialog extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Boolean, reflect: true }) open = false
    @property({ attribute: 'player-name' }) playerName = ''
    @property({ type: Array }) reasons: Array<{ id: string; label: string }> = DEFAULT_REASONS

    @state() private _reason = ''
    @state() private _comment = ''

    render() {
        if (!this.open) return nothing
        const reason = this._reason || this.reasons[0]?.id || ''
        return html`<div class="box">
            <h3>Report Player</h3>
            ${this.playerName ? html`<div class="player-name">${this.playerName}</div>` : nothing}
            <div class="reasons">${this.reasons.map((r) => html`<label>
                <input type="radio" name="reason" value=${r.id} ?checked=${reason === r.id}
                    @change=${() => { this._reason = r.id }} /> ${r.label}
            </label>`)}</div>
            <textarea placeholder="Additional details (optional)" .value=${this._comment}
                @input=${(event: Event) => { this._comment = (event.target as HTMLTextAreaElement).value }}></textarea>
            <div class="actions">
                <button class="cancel" @click=${() => this.emit('cancel')}>Cancel</button>
                <button class="submit" @click=${() => this.emit('submit', { reason, comment: this._comment })}>Submit Report</button>
            </div>
        </div>`
    }
}
