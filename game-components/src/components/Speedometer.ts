import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Speedometer.styles.js'

@customElement('gc-speedometer')
export class Speedometer extends GameElement {
    static styles = styles

    @property({ type: Number }) value = 0
    @property({ type: Number }) max = 220
    @property({ type: Number }) rpm: number | null = null
    @property() unit = 'mph'
    @property() gear = ''
    @property({ type: Number }) size = 180

    render() {
        const pct = Math.max(0, Math.min(1, this.value / this.max))
        const angle = -135 + pct * 270
        const danger = pct >= 0.85
        return html`<style>:host { --gc-size: ${this.size}px; }</style>
            <svg viewBox="0 0 100 100" width=${this.size} height=${this.size}>
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6" stroke-dasharray="212 360" transform="rotate(135 50 50)"></circle>
                <circle cx="50" cy="50" r="45" fill="none" stroke=${danger ? 'var(--gc-danger)' : 'var(--gc-accent)'} stroke-width="6" stroke-dasharray="${pct * 212} 360" transform="rotate(135 50 50)" stroke-linecap="round"></circle>
                ${this.rpm !== null ? html`<circle cx="50" cy="50" r="36" fill="none" stroke="var(--gc-gold)" stroke-width="2" stroke-dasharray="${Math.max(0, Math.min(1, this.rpm)) * 169} 360" transform="rotate(135 50 50)"></circle>` : nothing}
                <line x1="50" y1="50" x2="50" y2="20" stroke="#fff" stroke-width="2" stroke-linecap="round" transform="rotate(${angle} 50 50)"></line>
            </svg>
            <div class="info">
                <div class="value">${Math.round(this.value)}</div>
                <div class="unit">${this.unit}</div>
                ${this.gear ? html`<div class="gear">${this.gear}</div>` : nothing}
            </div>`
    }
}
