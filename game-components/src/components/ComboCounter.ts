import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ComboCounter.styles.js'

@customElement('gc-combo-counter')
export class ComboCounter extends GameElement {
    static styles = styles

    @property({ type: Number }) combo = 0
    @property() label = 'Combo'
    @property({ type: Number }) timer: number | null = null
    @property({ type: Number, attribute: 'font-size' }) fontSize = 36

    render() {
        if (this.combo <= 1) return nothing
        return html`<style>:host { --gc-font-size: ${this.fontSize}px; }</style>
            <div class="label">${this.label}</div>
            <div class="num">${this.combo}<span class="x">x</span></div>
            ${this.timer !== null ? html`<div class="bar"><div style="width: ${Math.max(0, Math.min(1, this.timer)) * 100}%"></div></div>` : nothing}`
    }
}
