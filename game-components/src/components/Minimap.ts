import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/Minimap.styles.js'

export interface MinimapMarker { id: string; x: number; y: number; color?: string; size?: number }

@customElement('gc-minimap')
export class Minimap extends GameElement {
    static styles = styles

    @property({ type: Number, attribute: 'world-x' }) worldX = 0
    @property({ type: Number, attribute: 'world-y' }) worldY = 0
    @property({ type: Number, attribute: 'world-width' }) worldWidth = 1000
    @property({ type: Number, attribute: 'world-height' }) worldHeight = 1000
    @property({ type: Array }) markers: MinimapMarker[] = []
    @property({ attribute: 'background-image' }) backgroundImage = ''
    @property({ type: Number }) size = 200
    @property({ type: Number }) rotation = 0

    render() {
        const bg = this.backgroundImage ? `url("${this.backgroundImage}")` : 'none'
        return html`<style>:host { --gc-size: ${this.size}px; --gc-rotation: ${this.rotation}deg; --gc-bg: ${bg}; }</style>
            <div class="inner">${this.markers.map((m) => {
                const px = ((m.x - this.worldX) / this.worldWidth) * this.size
                const py = ((m.y - this.worldY) / this.worldHeight) * this.size
                const ms = m.size ?? 6
                return html`<div class="marker" style="left: ${px - ms / 2}px; top: ${py - ms / 2}px; width: ${ms}px; height: ${ms}px; background: ${m.color ?? '#fff'};"></div>`
            })}</div>`
    }
}
