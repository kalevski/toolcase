import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/LetterboxBars.styles.js'

@customElement('gc-letterbox-bars')
export class LetterboxBars extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) show = false
    @property({ attribute: 'bar-height' }) barHeight = '12%'
    @property({ attribute: 'bar-color' }) barColor = '#000'
    @property({ type: Number }) duration = 600

    render() {
        return html`<style>:host { --gc-bar-height: ${this.barHeight}; --gc-bar-color: ${this.barColor}; --gc-duration: ${this.duration}ms; }</style>
            <div class="top"></div><div class="bottom"></div>`
    }
}
