import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/BuffIcon.scss'

@customElement('gc-buff-icon')
export class BuffIcon extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() glyph = ''
    @property() time = ''
    @property() kind: 'buff' | 'debuff' = 'buff'
    @property() color = ''
    @property({ type: Number }) size = 36

    render() {
        const colorVar = this.color || (this.kind === 'buff' ? 'var(--fg-stamina)' : 'var(--fg-blood)')
        const fgColor = this.color || (this.kind === 'buff' ? 'var(--fg-stamina-bright)' : 'var(--fg-blood-bright)')
        return html`<style>:host {
            --gc-buff-size: ${this.size}px;
            --gc-buff-border: ${colorVar};
            --gc-buff-color: ${fgColor};
            --gc-buff-glyph-size: ${this.size * 0.5}px;
        }</style>
            <div class="icon ${this.kind}">
                <span class="glyph"><slot>${this.glyph}</slot></span>
                ${this.time ? html`<span class="time">${this.time}</span>` : nothing}
            </div>`
    }
}
