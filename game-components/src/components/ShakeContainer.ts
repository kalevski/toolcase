import { html, css, unsafeCSS } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ShakeContainer.scss'

@customElement('gc-shake-container')
export class ShakeContainer extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() trigger = ''
    @property({ type: Number }) intensity = 6
    @property({ type: Number }) duration = 250

    @query('.wrap') private _wrap!: HTMLElement

    private _raf = 0
    private _lastTrigger = ''

    updated(): void {
        if (this.trigger && this.trigger !== this._lastTrigger) {
            this._lastTrigger = this.trigger
            this._shake()
        }
    }

    disconnectedCallback(): void {
        if (this._raf) cancelAnimationFrame(this._raf)
        super.disconnectedCallback()
    }

    private _shake(): void {
        if (!this._wrap) return
        if (this._raf) cancelAnimationFrame(this._raf)
        const start = performance.now()
        const tick = (now: number) => {
            const elapsed = now - start
            const t = Math.min(1, elapsed / this.duration)
            if (t >= 1) { this._wrap.style.transform = 'translate(0,0)'; return }
            const fall = 1 - t
            const dx = (Math.random() - 0.5) * 2 * this.intensity * fall
            const dy = (Math.random() - 0.5) * 2 * this.intensity * fall
            this._wrap.style.transform = `translate(${dx}px, ${dy}px)`
            this._raf = requestAnimationFrame(tick)
        }
        this._raf = requestAnimationFrame(tick)
    }

    render() { return html`<div class="wrap"><slot></slot></div>` }
}
