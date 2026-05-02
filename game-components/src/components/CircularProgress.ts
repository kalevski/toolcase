import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CircularProgress.scss'

@customElement('gc-circular-progress')
export class CircularProgress extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) value = 0
    @property({ type: Number }) max = 1
    @property({ type: Number }) size = 48
    @property({ type: Number }) thickness = 4
    @property() color = 'var(--fg-gold-bright)'
    @property() background = 'rgba(201, 169, 97, 0.2)'
    @property({ type: Boolean, attribute: 'show-text' }) showText = false
    @property({ type: Boolean }) reverse = false

    render() {
        const pct = Math.max(0, Math.min(1, this.value / this.max))
        const radius = (this.size - this.thickness) / 2
        const circ = 2 * Math.PI * radius
        const offset = this.reverse ? circ * pct : circ * (1 - pct)
        return html`<style>:host { --gc-size: ${this.size}px; --gc-progress-color: ${this.color}; }</style>
            <svg width=${this.size} height=${this.size}>
                <circle cx=${this.size / 2} cy=${this.size / 2} r=${radius} fill="none" stroke="rgba(0,0,0,0.6)" stroke-width=${this.thickness + 2}></circle>
                <circle cx=${this.size / 2} cy=${this.size / 2} r=${radius} fill="none" stroke=${this.background} stroke-width=${this.thickness}></circle>
                <circle cx=${this.size / 2} cy=${this.size / 2} r=${radius} fill="none" stroke=${this.color} stroke-width=${this.thickness}
                    stroke-dasharray=${circ} stroke-dashoffset=${offset} stroke-linecap="butt"
                    style="transition: stroke-dashoffset 150ms"></circle>
            </svg>
            <div class="label">${this.showText ? `${Math.round(pct * 100)}%` : html`<slot></slot>`}</div>
            ${nothing}`
    }
}
