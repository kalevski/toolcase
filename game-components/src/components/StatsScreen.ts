import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/StatsScreen.scss'

export interface StatsSection { title: string; stats: Array<{ label: string; value: string; icon?: string }> }

@customElement('gc-stats-screen')
export class StatsScreen extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) sections: StatsSection[] = []
    @property({ attribute: 'screen-title' }) screenTitle = ''
    @property() summary = ''

    render() {
        return html`
            ${this.screenTitle ? html`<h2>${this.screenTitle}</h2>` : nothing}
            ${this.summary ? html`<div class="summary">${this.summary}</div>` : nothing}
            ${this.sections.map((section) => html`<section>
                <div class="title">${section.title}</div>
                <div class="grid">${section.stats.map((stat) => html`<div class="stat">
                    <div class="label">${stat.icon ?? ''}${stat.label}</div>
                    <div class="value">${stat.value}</div>
                </div>`)}</div>
            </section>`)}`
    }
}
