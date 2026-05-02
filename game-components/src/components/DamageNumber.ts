import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/DamageNumber.scss'

@customElement('gc-damage-number')
export class DamageNumber extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

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
        const color = this.miss ? 'var(--fg-parch-3)' : this.crit ? '#ffd25a' : this.heal ? 'var(--fg-stamina-bright)' : 'var(--fg-blood-bright)'
        const fontSize = this.crit ? 28 : 18
        return html`<style>:host { --gc-color: ${color}; --gc-font-size: ${fontSize}px; --gc-duration: ${this.duration}ms; }</style>
            ${this.miss ? 'Miss' : this.value}`
    }
}
