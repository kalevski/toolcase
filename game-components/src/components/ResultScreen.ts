import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ResultScreen.styles.js'

export interface ResultStat { label: string; value: string }
export interface ResultReward { label: string; value?: string; icon?: string }
export interface ResultAction { id: string; label: string; primary?: boolean; danger?: boolean }

@customElement('gc-result-screen')
export class ResultScreen extends GameElement {
    static styles = styles

    @property({ attribute: 'title-text' }) titleText = ''
    @property() subtitle = ''
    @property({ type: Array }) stats: ResultStat[] = []
    @property({ type: Array }) rewards: ResultReward[] = []
    @property({ type: Array }) actions: ResultAction[] = []
    @property({ attribute: 'title-color' }) titleColor = '#fff'

    render() {
        const cols = Math.min(this.stats.length || 1, 4)
        return html`<style>:host { --gc-title-color: ${this.titleColor}; --gc-stat-cols: repeat(${cols}, 1fr); }</style>
            <div style="text-align:center"><h1>${this.titleText}</h1>${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : nothing}</div>
            ${this.stats.length ? html`<div class="stats">${this.stats.map((stat) => html`<div class="stat">
                <div class="label">${stat.label}</div><div class="value">${stat.value}</div>
            </div>`)}</div>` : nothing}
            ${this.rewards.length ? html`<div class="rewards">${this.rewards.map((r) => html`<div class="reward">
                <span>${r.icon ?? ''}</span><span>${r.label}</span>${r.value ? html`<strong>${r.value}</strong>` : nothing}
            </div>`)}</div>` : nothing}
            ${this.actions.length ? html`<div class="actions">${this.actions.map((a) => html`
                <button class=${a.primary ? 'primary' : a.danger ? 'danger' : 'secondary'} @click=${() => this.emit('action', { id: a.id })}>${a.label}</button>
            `)}</div>` : nothing}`
    }
}
