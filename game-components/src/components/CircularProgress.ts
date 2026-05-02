import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CircularProgress.styles.js'

@customElement('gc-circular-progress')
export class CircularProgress extends GameElement {
    static styles = styles

    @property({ type: Number }) value = 0
    @property({ type: Number }) max = 1
    @property({ type: Number }) size = 48
    @property({ type: Number }) thickness = 4
    @property() color = 'var(--gc-accent, #6aa9ff)'
    @property() background = 'rgba(255,255,255,0.1)'
    @property({ type: Boolean, attribute: 'show-text' }) showText = false
    @property({ type: Boolean }) reverse = false

    render() {
        const pct = Math.max(0, Math.min(1, this.value / this.max))
        const radius = (this.size - this.thickness) / 2
        const circ = 2 * Math.PI * radius
        const offset = this.reverse ? circ * pct : circ * (1 - pct)
        return html`<style>:host { --gc-size: ${this.size}px; }</style>
            <svg width=${this.size} height=${this.size}>
                <circle cx=${this.size / 2} cy=${this.size / 2} r=${radius} fill="none" stroke=${this.background} stroke-width=${this.thickness}></circle>
                <circle cx=${this.size / 2} cy=${this.size / 2} r=${radius} fill="none" stroke=${this.color} stroke-width=${this.thickness}
                    stroke-dasharray=${circ} stroke-dashoffset=${offset} stroke-linecap="round"
                    style="transition: stroke-dashoffset 150ms"></circle>
            </svg>
            <div class="label">${this.showText ? `${Math.round(pct * 100)}%` : html`<slot></slot>`}</div>
            ${nothing}`
    }
}
