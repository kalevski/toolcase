import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/StatRow.scss'

@customElement('gc-stat-row')
export class StatRow extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property() label = ''
    @property() value: string | number = ''
    @property() accent = 'var(--fg-gold-bright)'
    @property({ type: Number }) trend: number | null = null

    render() {
        const trendColor = this.trend != null && this.trend > 0
            ? 'var(--fg-stamina-bright)'
            : 'var(--fg-blood-bright)'
        return html`<style>:host { --gc-stat-accent: ${this.accent}; --gc-stat-trend: ${trendColor}; }</style>
            <div class="row">
                <span class="label">${this.label}</span>
                <span class="value">
                    ${this.value}
                    ${this.trend != null ? html`<span class="trend">${this.trend > 0 ? '▲' : '▼'}${Math.abs(this.trend)}</span>` : nothing}
                </span>
            </div>`
    }
}
