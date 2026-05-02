import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/BossBar.scss'

@customElement('gc-boss-bar')
export class BossBar extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() name = ''
    @property() epithet = ''
    @property() phase = ''
    @property({ type: Number }) hp = 0
    @property({ type: Number, attribute: 'hp-max' }) hpMax = 100
    @property({ type: Array }) phaseTicks: number[] = []

    render() {
        const pct = Math.max(0, Math.min(1, this.hp / this.hpMax)) * 100
        return html`<div class="frame">
            <div class="head">
                ${this.epithet ? html`<div class="epithet">✦ ${this.epithet} ✦</div>` : nothing}
                <div class="name">${this.name}</div>
            </div>
            <div class="bar">
                <div class="fill" style="width: ${pct}%"></div>
                ${this.phaseTicks.map((tick) => html`<div class="tick" style="left: ${tick}%"></div>`)}
            </div>
            <div class="meta">
                ${this.phase ? html`<span class="phase">${this.phase}</span>` : nothing}
                <span class="value">${this.hp.toLocaleString()} / ${this.hpMax.toLocaleString()}</span>
            </div>
        </div>`
    }
}
