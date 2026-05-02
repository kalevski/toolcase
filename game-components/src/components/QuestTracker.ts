import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/QuestTracker.scss'

export interface QuestObjective { id: string; text: string; progress?: number; target?: number; completed?: boolean; optional?: boolean }
export interface QuestEntry { id: string; name: string; objectives: QuestObjective[] }

@customElement('gc-quest-tracker')
export class QuestTracker extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) quests: QuestEntry[] = []
    @property({ attribute: 'tracker-title' }) trackerTitle = ''

    render() {
        return html`
            ${this.trackerTitle ? html`<div class="title">${this.trackerTitle}</div>` : nothing}
            ${this.quests.map((q) => html`<div class="quest">
                <div class="quest-name">${q.name}</div>
                <div class="divider"><div class="diamond"></div></div>
                <ul>${q.objectives.map((o) => html`<li class="${o.completed ? 'done' : ''} ${o.optional ? 'optional' : ''}">
                    <span class="dot ${o.completed ? 'completed' : ''}">${o.completed ? '✓' : '◇'}</span>
                    <span class="text">${o.text}${o.optional ? html` <em>(optional)</em>` : nothing}</span>
                    ${o.target !== undefined && o.progress !== undefined ? html`<span class="progress">${o.progress} / ${o.target}</span>` : nothing}
                </li>`)}</ul>
            </div>`)}`
    }
}
