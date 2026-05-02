import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/LoadingScreen.scss'

@customElement('gc-loading-screen')
export class LoadingScreen extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) progress: number | null = null
    @property() label = 'Loading...'
    @property() eyebrow = ''
    @property({ attribute: 'title-text' }) titleText = ''
    @property({ attribute: 'tip-title' }) tipTitle = 'Wisdom of the road'
    @property({ type: Array }) tips: string[] = []
    @property({ type: Number, attribute: 'tip-interval' }) tipInterval = 5000

    @state() private _tipIndex = 0
    private _tipTimer = 0

    connectedCallback(): void {
        super.connectedCallback()
        if (this.tips.length > 1) {
            this._tipTimer = window.setInterval(() => { this._tipIndex = (this._tipIndex + 1) % this.tips.length }, this.tipInterval)
        }
    }
    disconnectedCallback(): void { if (this._tipTimer) window.clearInterval(this._tipTimer); super.disconnectedCallback() }

    render() {
        const pct = this.progress === null ? null : Math.max(0, Math.min(1, this.progress))
        const tip = this.tips[this._tipIndex]
        return html`
            <slot name="art"></slot>
            <div class="footer">
                ${this.eyebrow ? html`<div class="eyebrow">${this.eyebrow}</div>` : nothing}
                ${this.titleText ? html`<div class="title">${this.titleText}</div>` : nothing}
                ${tip ? html`<div class="tip-card">
                    <div class="tip-title">✦ ${this.tipTitle}</div>
                    <div class="tip">${tip}</div>
                </div>` : nothing}
                <div class="meta"><span>${this.label}</span>${pct !== null ? html`<span class="pct">${Math.round(pct * 100)}%</span>` : nothing}</div>
                <div class="bar"><div class="fill ${pct === null ? 'indet' : ''}" style="width: ${pct !== null ? pct * 100 : 30}%"></div></div>
            </div>`
    }
}
