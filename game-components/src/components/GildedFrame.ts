import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/GildedFrame.scss'

@customElement('gc-gilded-frame')
export class GildedFrame extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() tone: 'dark' | 'leather' | 'transparent' = 'dark'
    @property() padding = '0'

    render() {
        return html`<style>:host { --gc-frame-padding: ${this.padding}; }</style>
            <div class="frame tone-${this.tone}"><slot></slot></div>`
    }
}
