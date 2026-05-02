import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/SafeArea.styles.js'

@customElement('gc-safe-area')
export class SafeArea extends GameElement {
    static styles = styles

    @property({ type: Number }) extra = 0

    render() {
        return html`<style>:host { --gc-extra: ${this.extra}px; }</style><slot></slot>`
    }
}
