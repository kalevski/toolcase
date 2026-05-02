import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Portrait.scss'

@customElement('gc-portrait')
export class Portrait extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() glyph = '✦'
    @property({ type: Number }) size = 64
    @property() ring = ''
    @property({ type: Number }) level: number | null = null
    @property({ type: Boolean }) circle = false

    render() {
        const ringStyle = this.ring ? `--gc-portrait-ring: ${this.ring};` : ''
        return html`<style>:host { --gc-portrait-size: ${this.size}px; ${ringStyle} }</style>
            <div class="wrap">
                <div class="portrait ${this.circle ? 'circle' : ''}" style="font-size: ${this.size * 0.4}px;">
                    <slot>${this.glyph}</slot>
                </div>
                ${this.level != null ? html`<div class="level">${this.level}</div>` : nothing}
            </div>`
    }
}
