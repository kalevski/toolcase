import { html, nothing } from 'lit'
import { property } from 'lit/decorators.js'
import { GameElement } from '../base.js'

export abstract class ResourceBarBase extends GameElement {
    @property({ type: Number }) value = 0
    @property({ type: Number }) max = 100
    @property({ type: Number }) ghost: number | null = null
    @property({ type: Number }) segments = 1
    @property({ type: Boolean, attribute: 'show-text' }) showText = false
    @property() label = ''

    render() {
        const pct = Math.max(0, Math.min(1, this.value / this.max))
        const ghostPct = this.ghost === null ? null : Math.max(0, Math.min(1, this.ghost / this.max))
        const segs = this.segments > 1 ? Array.from({ length: this.segments }) : []
        return html`
            ${(this.label || this.showText) ? html`<div class="head">
                <span>${this.label}</span>
                ${this.showText ? html`<span>${Math.round(this.value)} / ${this.max}</span>` : nothing}
            </div>` : nothing}
            <div class="bar">
                ${ghostPct !== null && ghostPct > pct ? html`<div class="ghost" style="left: ${pct * 100}%; width: ${(ghostPct - pct) * 100}%;"></div>` : nothing}
                <div class="fill" style="width: ${pct * 100}%"></div>
                ${segs.length ? html`<div class="segs">${segs.map(() => html`<div class="seg"></div>`)}</div>` : nothing}
            </div>`
    }
}
