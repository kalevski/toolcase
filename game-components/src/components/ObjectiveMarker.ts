import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ObjectiveMarker.styles.js'

@customElement('gc-objective-marker')
export class ObjectiveMarker extends GameElement {
    static styles = styles

    @property({ type: Number }) x = 0
    @property({ type: Number }) y = 0
    @property() label = ''
    @property() distance = ''
    @property() color = ''
    @property({ type: Number }) size = 32
    @property({ type: Boolean, reflect: true }) pulse = true

    render() {
        return html`<style>:host { left: ${this.x}px; top: ${this.y}px; --gc-size: ${this.size}px; ${this.color ? `--gc-color: ${this.color};` : ''} }</style>
            <div class="icon">◆</div>
            ${this.label ? html`<div class="label">${this.label}</div>` : nothing}
            ${this.distance ? html`<div class="distance">${this.distance}</div>` : nothing}`
    }
}
