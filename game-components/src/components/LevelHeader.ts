import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/LevelHeader.scss'

@customElement('gc-level-header')
export class LevelHeader extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Number }) level = 1
    @property() title = ''
    @property({ type: Number }) xp = 0
    @property({ type: Number, attribute: 'xp-max' }) xpMax = 100
    @property({ attribute: 'next-label' }) nextLabel = 'Next Tier'

    render() {
        const pct = Math.max(0, Math.min(1, this.xp / this.xpMax)) * 100
        return html`<div class="frame">
            <div class="head">
                <div class="left">
                    <span class="num">${this.level}</span>
                    <div class="meta">
                        <span class="eyebrow">Level</span>
                        ${this.title ? html`<span class="title">${this.title}</span>` : nothing}
                    </div>
                </div>
                <div class="right">
                    <span class="next">${this.nextLabel}</span>
                    <span class="value">${this.xp.toLocaleString()} / ${this.xpMax.toLocaleString()}</span>
                </div>
            </div>
            <div class="bar"><div class="fill" style="width: ${pct}%"></div></div>
        </div>`
    }
}
