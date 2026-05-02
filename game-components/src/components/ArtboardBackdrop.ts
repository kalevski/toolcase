import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ArtboardBackdrop.scss'

@customElement('gc-artboard-backdrop')
export class ArtboardBackdrop extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() kind: 'dark' | 'scene' | 'parch' = 'dark'
    @property() padding = '24px'

    render() {
        return html`<style>:host { --gc-pad: ${this.padding}; }</style>
            <div class="bg kind-${this.kind}"><slot></slot></div>`
    }
}
