import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/PingDisplay.scss'

@customElement('gc-ping-display')
export class PingDisplay extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) ping: number | null = null

    render() {
        const color = this.ping === null ? '#5a5f68' : this.ping < 60 ? 'var(--gc-success)' : this.ping < 200 ? 'var(--gc-warning)' : 'var(--gc-danger)'
        return html`<style>:host { --gc-color: ${color}; }</style>${this.ping === null ? '—ms' : `${this.ping}ms`}`
    }
}
