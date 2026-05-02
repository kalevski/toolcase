import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Anchor.scss'

export type AnchorPosition =
    | 'top-left' | 'top' | 'top-right'
    | 'left' | 'center' | 'right'
    | 'bottom-left' | 'bottom' | 'bottom-right'

@customElement('gc-anchor')
export class Anchor extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ reflect: true }) position: AnchorPosition = 'top-left'
    @property() inset = '16px'

    render() {
        return html`<style>:host { --gc-inset: ${this.inset}; }</style><slot></slot>`
    }
}
