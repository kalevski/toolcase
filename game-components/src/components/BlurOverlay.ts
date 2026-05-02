import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/BlurOverlay.styles.js'

@customElement('gc-blur-overlay')
export class BlurOverlay extends GameElement {
    static styles = styles

    @property({ type: Number }) blur = 8
    @property() background = 'rgba(0,0,0,0.3)'

    render() {
        return html`<style>:host { --gc-blur: ${this.blur}px; --gc-bg: ${this.background}; }</style><slot></slot>`
    }
}
