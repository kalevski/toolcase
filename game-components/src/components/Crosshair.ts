import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/Crosshair.scss'

@customElement('gc-crosshair')
export class Crosshair extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() variant: 'cross' | 'dot' | 'circle' | 'tShape' | 'classic' | 'rune' = 'rune'
    @property({ type: Number }) size = 24
    @property({ type: Number }) thickness = 1
    @property({ type: Number }) gap = 6
    @property() color = 'var(--fg-gold-bright)'
    @property({ type: Number }) spread = 0

    render() {
        const off = this.gap + this.spread
        const lineCss = `background: ${this.color};`
        if (this.variant === 'rune') {
            return html`
                <div class="line" style="${lineCss} width: ${this.thickness}px; height: ${this.size}px; transform: translate(-50%, calc(-100% - ${off}px));"></div>
                <div class="line" style="${lineCss} width: ${this.thickness}px; height: ${this.size}px; transform: translate(-50%, ${off}px);"></div>
                <div class="line" style="${lineCss} width: ${this.size}px; height: ${this.thickness}px; transform: translate(calc(-100% - ${off}px), -50%);"></div>
                <div class="line" style="${lineCss} width: ${this.size}px; height: ${this.thickness}px; transform: translate(${off}px, -50%);"></div>
                <div class="diamond" style="width: 18px; height: 18px;"></div>
                <div class="center-dot" style="width: 3px; height: 3px;"></div>`
        }
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
