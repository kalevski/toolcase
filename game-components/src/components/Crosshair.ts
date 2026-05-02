import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Crosshair.styles.js'

@customElement('gc-crosshair')
export class Crosshair extends GameElement {
    static styles = styles

    @property() variant: 'cross' | 'dot' | 'circle' | 'tShape' | 'classic' = 'classic'
    @property({ type: Number }) size = 16
    @property({ type: Number }) thickness = 2
    @property({ type: Number }) gap = 4
    @property() color = '#fff'
    @property({ type: Number }) spread = 0

    render() {
        const off = this.gap + this.spread
        const lineCss = `background: ${this.color};`
        if (this.variant === 'dot') {
            return html`<div class="line" style="${lineCss} width: ${this.thickness * 2}px; height: ${this.thickness * 2}px; border-radius: 50%; transform: translate(-50%, -50%);"></div>`
        }
        if (this.variant === 'circle') {
            return html`<div class="ring" style="width: ${this.size * 2}px; height: ${this.size * 2}px; border: ${this.thickness}px solid ${this.color};"></div>`
        }
        return html`
            <div class="line" style="${lineCss} width: ${this.thickness}px; height: ${this.size}px; transform: translate(-50%, calc(-100% - ${off}px));"></div>
            ${this.variant === 'tShape' ? nothing : html`<div class="line" style="${lineCss} width: ${this.thickness}px; height: ${this.size}px; transform: translate(-50%, ${off}px);"></div>`}
            <div class="line" style="${lineCss} width: ${this.size}px; height: ${this.thickness}px; transform: translate(calc(-100% - ${off}px), -50%);"></div>
            <div class="line" style="${lineCss} width: ${this.size}px; height: ${this.thickness}px; transform: translate(${off}px, -50%);"></div>
            ${this.variant === 'classic' ? html`<div class="line" style="${lineCss} width: ${this.thickness}px; height: ${this.thickness}px; border-radius: 50%; transform: translate(-50%, -50%);"></div>` : nothing}`
    }
}
