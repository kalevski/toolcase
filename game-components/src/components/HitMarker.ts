import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/HitMarker.styles.js'

@customElement('gc-hit-marker')
export class HitMarker extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) show = false
    @property({ type: Boolean }) crit = false
    @property({ type: Boolean }) kill = false
    @property({ type: Number }) size = 16
    @property({ type: Number }) duration = 200

    private _hideTimer = 0

    updated(changed: Map<string, unknown>): void {
        if (changed.has('show') && this.show) {
            if (this._hideTimer) window.clearTimeout(this._hideTimer)
            this._hideTimer = window.setTimeout(() => { this.show = false; this.emit('done') }, this.duration)
        }
    }

    render() {
        const color = this.kill ? 'var(--gc-danger, #d23a3a)' : this.crit ? 'var(--gc-gold, #ffd35a)' : '#fff'
        return html`<style>:host { --gc-color: ${color}; transition-duration: ${this.duration}ms; }</style>
            ${[45, -45, 135, -135].map((angle) => html`
                <div class="line" style="width: ${this.size * 0.5}px; height: 2px; transform: rotate(${angle}deg) translateX(${this.size * 0.5}px);"></div>
            `)}`
    }
}
