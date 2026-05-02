import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/IconBadge.scss'

@customElement('gc-icon-badge')
export class IconBadge extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() glyph = ''
    @property({ type: Number }) size = 32
    @property() color = 'var(--fg-gold-bright)'
    @property() bg = ''

    render() {
        const bgValue = this.bg || 'linear-gradient(180deg, #2a1f14, #0a0604)'
        return html`<style>:host {
            --gc-badge-size: ${this.size}px;
            --gc-badge-color: ${this.color};
            --gc-badge-bg: ${bgValue};
            --gc-badge-glyph: ${this.size * 0.5}px;
        }</style>
            <div class="badge"><slot>${this.glyph}</slot></div>`
    }
}
