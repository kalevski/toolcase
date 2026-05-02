import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/NetworkStatusIcon.styles.js'

@customElement('gc-network-status-icon')
export class NetworkStatusIcon extends GameElement {
    static styles = styles

    @property({ type: Number }) ping: number | null = null
    @property({ type: Number }) loss = 0
    @property({ type: Boolean }) connected = true
    @property({ type: Number }) size = 16
    @property({ type: Boolean, attribute: 'show-label' }) showLabel = false

    render() {
        const bars = !this.connected ? 0 : this.ping === null ? 4 : this.ping < 60 ? 4 : this.ping < 120 ? 3 : this.ping < 200 ? 2 : 1
        const color = !this.connected ? 'var(--gc-danger)' : this.loss > 0.05 ? 'var(--gc-warning)' : (this.ping !== null && this.ping > 200) ? 'var(--gc-warning)' : 'var(--gc-success)'
        return html`<style>:host { --gc-color: ${color}; font-size: ${this.size * 0.7}px; }</style>
            ${[0, 1, 2, 3].map((i) => html`<span class=${`bar ${i < bars ? 'active' : ''}`}
                style=${`width: ${this.size / 5}px; height: ${this.size * (0.3 + i * 0.2)}px;`}></span>`)}
            ${this.showLabel && this.ping !== null ? html`<span class="label">${this.ping}ms</span>` : nothing}`
    }
}
