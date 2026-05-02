import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CompassRose.scss'

@customElement('gc-compass-rose')
export class CompassRose extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) heading = 0
    @property({ type: Number }) size = 64

    render() {
        return html`<svg viewBox="0 0 100 100" width=${this.size} height=${this.size}>
            <defs>
                <radialGradient id="rose-bg" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stop-color="#3a2a18"/>
                    <stop offset="80%" stop-color="#0a0604"/>
                </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#rose-bg)" stroke="var(--fg-gold-deep)" stroke-width="1.5"></circle>
            <circle cx="50" cy="50" r="44" fill="none" stroke="var(--fg-gold-shadow)" stroke-width="0.5" stroke-dasharray="2 3"></circle>
            <g class="ring" transform="rotate(${-this.heading} 50 50)" font-family="Cinzel, serif">
                <polygon points="50,10 56,50 50,46 44,50" fill="var(--fg-blood-bright)" stroke="#000" stroke-width="0.4"></polygon>
                <polygon points="50,90 56,50 50,54 44,50" fill="var(--fg-gold-bright)" stroke="#000" stroke-width="0.4"></polygon>
                <text x="50" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="var(--fg-blood-bright)" letter-spacing="0.08em">N</text>
                <text x="50" y="84" text-anchor="middle" font-size="9" fill="var(--fg-gold)" letter-spacing="0.08em">S</text>
                <text x="84" y="53" text-anchor="middle" font-size="9" fill="var(--fg-gold)" letter-spacing="0.08em">E</text>
                <text x="16" y="53" text-anchor="middle" font-size="9" fill="var(--fg-gold)" letter-spacing="0.08em">W</text>
            </g>
        </svg>`
    }
}
