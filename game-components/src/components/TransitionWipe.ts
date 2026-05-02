import { html } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/TransitionWipe.styles.js'

@customElement('gc-transition-wipe')
export class TransitionWipe extends GameElement {
    static styles = styles

    @property({ type: Boolean, reflect: true }) show = false
    @property({ reflect: true }) direction: 'fade' | 'left' | 'right' | 'up' | 'down' | 'iris' = 'fade'
    @property({ type: Number }) duration = 600
    @property({ attribute: 'wipe-color' }) wipeColor = '#000'

    private _completeTimer = 0

    updated(changed: Map<string, unknown>): void {
        if (changed.has('show') && this.show) {
            if (this._completeTimer) window.clearTimeout(this._completeTimer)
            this._completeTimer = window.setTimeout(() => this.emit('complete'), this.duration)
        }
    }

    render() {
        return html`<style>:host { --gc-color: ${this.wipeColor}; --gc-duration: ${this.duration}ms; }</style>`
    }
}
