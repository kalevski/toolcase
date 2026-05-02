import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CompassRose.styles.js'

@customElement('gc-compass-rose')
export class CompassRose extends GameElement {
    static styles = styles

    @property({ type: Number }) heading = 0
    @property({ type: Number }) size = 64

    render() {
        return html`<svg viewBox="0 0 100 100" width=${this.size} height=${this.size}>
            <circle cx="50" cy="50" r="46" fill="rgba(15,18,24,0.7)" stroke="rgba(255,255,255,0.2)" stroke-width="2"></circle>
            <g class="ring" transform="rotate(${-this.heading} 50 50)">
                <polygon points="50,12 56,50 50,46 44,50" fill="#d23a3a"></polygon>
                <polygon points="50,88 56,50 50,54 44,50" fill="#fff"></polygon>
                <text x="50" y="22" text-anchor="middle" font-size="10" font-weight="700" fill="#fff">N</text>
                <text x="50" y="84" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.6)">S</text>
                <text x="84" y="53" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.6)">E</text>
                <text x="16" y="53" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.6)">W</text>
            </g>
        </svg>`
    }
}
