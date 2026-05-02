import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/VignetteOverlay.scss'

@customElement('gc-vignette-overlay')
export class VignetteOverlay extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) intensity = 0.4
    @property({ attribute: 'vignette-color' }) vignetteColor = ''

    render() {
        const value = Math.max(0, Math.min(1, this.intensity))
        return html`<style>:host { --gc-intensity: ${value}; ${this.vignetteColor ? `--gc-color: ${this.vignetteColor};` : ''} }</style>`
    }
}
