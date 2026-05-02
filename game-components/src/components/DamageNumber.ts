import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/DamageNumber.styles.js'

@customElement('gc-damage-number')
export class DamageNumber extends GameElement {
    static styles = styles

    @property() value = '0'
    @property({ type: Boolean }) crit = false
    @property({ type: Boolean }) heal = false
    @property({ type: Boolean }) miss = false
    @property({ type: Number }) duration = 900

    connectedCallback(): void {
        super.connectedCallback()
        window.setTimeout(() => this.emit('done'), this.duration)
    }

    render() {
        const color = this.miss ? '#a0a4ad' : this.crit ? 'var(--gc-gold, #ffd35a)' : this.heal ? 'var(--gc-success, #3aa256)' : '#ff5a5a'
        const fontSize = this.crit ? 28 : 20
        return html`<style>:host { --gc-color: ${color}; --gc-font-size: ${fontSize}px; --gc-duration: ${this.duration}ms; }</style>
            ${this.miss ? 'Miss' : this.value}`
    }
}
