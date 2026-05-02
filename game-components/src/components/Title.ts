import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Title.scss'

@customElement('gc-title')
export class Title extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) size = 18

    render() {
        return html`<style>:host { --gc-title-size: ${this.size}px; }</style>
            <span class="title"><slot></slot></span>`
    }
}
