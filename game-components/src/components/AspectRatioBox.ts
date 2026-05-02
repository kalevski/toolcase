import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/AspectRatioBox.styles.js'

@customElement('gc-aspect-ratio-box')
export class AspectRatioBox extends GameElement {
    static styles = styles

    @property() ratio = '16 / 9'

    render() {
        return html`<style>:host { --gc-ratio: ${this.ratio}; }</style><div class="inner"><slot></slot></div>`
    }
}
