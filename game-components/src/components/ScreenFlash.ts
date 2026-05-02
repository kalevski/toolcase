import { html } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ScreenFlash.styles.js'

@customElement('gc-screen-flash')
export class ScreenFlash extends GameElement {
    static styles = styles

    @property({ attribute: 'flash-color' }) flashColor = '#ff5a5a'
    @property({ type: Number, attribute: 'flash-opacity' }) flashOpacity = 0.4
    @property({ type: Number }) duration = 250
    @property() trigger = ''

    @state() private _active = false
    private _timer = 0
    private _lastTrigger = ''

    updated(): void {
        if (this.trigger && this.trigger !== this._lastTrigger) {
            this._lastTrigger = this.trigger
            this._active = true
            this.toggleAttribute('active', true)
            if (this._timer) window.clearTimeout(this._timer)
            this._timer = window.setTimeout(() => {
                this._active = false
                this.toggleAttribute('active', false)
                this.emit('done')
            }, this.duration)
        }
    }

    render() {
        return html`<style>:host { --gc-color: ${this.flashColor}; --gc-opacity: ${this.flashOpacity}; --gc-duration: ${this.duration}ms; }</style>`
    }
}
