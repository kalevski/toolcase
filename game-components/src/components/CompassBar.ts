import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CompassBar.styles.js'

export interface CompassMarker { id: string; heading: number; color?: string; label?: string; icon?: string }

const CARDINALS = [{ h: 0, l: 'N' }, { h: 45, l: 'NE' }, { h: 90, l: 'E' }, { h: 135, l: 'SE' }, { h: 180, l: 'S' }, { h: 225, l: 'SW' }, { h: 270, l: 'W' }, { h: 315, l: 'NW' }]

@customElement('gc-compass-bar')
export class CompassBar extends GameElement {
    static styles = styles

    @property({ type: Number }) heading = 0
    @property({ type: Number }) fov = 120
    @property({ type: Array }) markers: CompassMarker[] = []
    @property() width = '360px'
    @property({ type: Number }) height = 28
    @property({ type: Boolean, attribute: 'show-cardinals' }) showCardinals = true

    private _rel(target: number): number {
        return ((target - this.heading + 540) % 360) - 180
    }

    render() {
        const halfFov = this.fov / 2
        return html`<style>:host { --gc-width: ${this.width}; --gc-height: ${this.height}px; }</style>
            ${this.showCardinals ? CARDINALS.map((c) => {
                const rel = this._rel(c.h)
                if (Math.abs(rel) > halfFov) return nothing
                const left = ((rel + halfFov) / this.fov) * 100
                return html`<div class="cardinal" style="left: ${left}%">${c.l}</div>`
            }) : nothing}
            ${this.markers.map((m) => {
                const rel = this._rel(m.heading)
                if (Math.abs(rel) > halfFov) return nothing
                const left = ((rel + halfFov) / this.fov) * 100
                return html`<div class="marker" style="left: ${left}%; color: ${m.color ?? 'var(--gc-accent)'}" title=${m.label ?? ''}>${m.icon ?? '▼'}</div>`
            })}
            <div class="center-line"></div>`
    }
}
