import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ScoreDisplay.styles.js'

@customElement('gc-score-display')
export class ScoreDisplay extends GameElement {
    static styles = styles

    @property({ type: Number }) score = 0
    @property({ type: Number }) multiplier: number | null = null
    @property() label = ''
    @property() align: 'left' | 'right' | 'center' = 'right'
    @property({ type: Number, attribute: 'font-size' }) fontSize = 28

    render() {
        return html`<style>:host { --gc-align: ${this.align}; --gc-font-size: ${this.fontSize}px; }</style>
            ${this.label ? html`<div class="label">${this.label}</div>` : nothing}
            <div class="score">${this.score.toLocaleString()}</div>
            ${this.multiplier !== null && this.multiplier !== 1 ? html`<div class="multiplier">x${this.multiplier}</div>` : nothing}`
    }
}
