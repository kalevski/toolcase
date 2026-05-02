import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/WaypointMarker.styles.js'

@customElement('gc-waypoint-marker')
export class WaypointMarker extends GameElement {
    static styles = styles

    @property({ type: Number }) x = 0
    @property({ type: Number }) y = 0
    @property() label = ''
    @property() distance = ''
    @property() color = ''
    @property() icon = '◆'
    @property({ type: Number }) size = 28

    render() {
        return html`<style>:host { left: ${this.x}px; top: ${this.y}px; --gc-size: ${this.size}px; ${this.color ? `--gc-color: ${this.color};` : ''} }</style>
            <div class="icon">${this.icon}</div>
            ${this.label ? html`<div class="label">${this.label}</div>` : nothing}
            ${this.distance ? html`<div class="distance">${this.distance}</div>` : nothing}`
    }
}
