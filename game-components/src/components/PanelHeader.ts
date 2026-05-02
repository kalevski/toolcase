import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/PanelHeader.scss'

@customElement('gc-panel-header')
export class PanelHeader extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() eyebrow = ''
    @property({ attribute: 'header-title' }) headerTitle = ''
    @property({ type: Number, attribute: 'title-size' }) titleSize = 18

    render() {
        return html`<style>:host { --gc-title-size: ${this.titleSize}px; }</style>
            <div class="header">
                <div class="left">
                    ${this.eyebrow ? html`<span class="eyebrow">${this.eyebrow}</span>` : nothing}
                    ${this.headerTitle ? html`<span class="title">${this.headerTitle}</span>` : nothing}
                </div>
                <div class="right"><slot name="right"></slot></div>
            </div>`
    }
}
