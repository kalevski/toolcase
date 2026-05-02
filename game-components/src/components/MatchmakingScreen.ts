import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/MatchmakingScreen.styles.js'

const STATE_TEXT: Record<string, string> = { searching: 'Searching for match', connecting: 'Connecting...', failed: 'Matchmaking failed', idle: 'Idle' }

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

@customElement('gc-matchmaking-screen')
export class MatchmakingScreen extends GameElement {
    static styles = styles

    @property() state: 'searching' | 'connecting' | 'found' | 'failed' | 'idle' = 'searching'
    @property({ type: Number }) elapsed = 0
    @property({ type: Number }) estimated: number | null = null
    @property() region = ''
    @property() mode = ''
    @property({ attribute: 'found-label' }) foundLabel = 'Match Found!'

    render() {
        const animate = this.state === 'searching' || this.state === 'connecting'
        const stateText = this.state === 'found' ? this.foundLabel : (STATE_TEXT[this.state] ?? this.state)
        const spinColor = this.state === 'found' ? 'var(--gc-success)' : 'var(--gc-accent)'
        return html`<style>:host { --gc-spin-color: ${spinColor}; }</style>
            <div class="spin ${animate ? 'animate' : ''}"></div>
            <div class="title">${stateText}</div>
            <div class="meta">
                ${this.mode ? html`<div>Mode: ${this.mode}</div>` : nothing}
                ${this.region ? html`<div>Region: ${this.region}</div>` : nothing}
                <div>Elapsed: ${fmt(this.elapsed)}</div>
                ${this.estimated !== null ? html`<div>Est: ${fmt(this.estimated)}</div>` : nothing}
            </div>
            <div class="actions">
                ${this.state === 'found' ? html`<button class="accept" @click=${() => this.emit('accept')}>Accept</button>` : nothing}
                <button class="cancel" @click=${() => this.emit('cancel')}>Cancel</button>
            </div>`
    }
}
