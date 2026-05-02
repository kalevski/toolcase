import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Anchor.styles.js'

export type AnchorPosition =
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'center' | 'right'
    | 'bottom-left' | 'bottom' | 'bottom-right'

@customElement('gc-anchor')
export class Anchor extends GameElement {
    static styles = styles

    @property({ reflect: true }) position: AnchorPosition = 'top-left'
    @property() inset = '16px'

    render() {
        return html`<style>:host { --gc-inset: ${this.inset}; }</style><slot></slot>`
    }
}
