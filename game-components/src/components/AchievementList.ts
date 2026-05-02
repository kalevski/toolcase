import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/AchievementList.styles.js'

export interface Achievement {
    id: string
    name: string
    description?: string
    icon?: string
    unlocked?: boolean
    progress?: number
    target?: number
    points?: number
    secret?: boolean
}

@customElement('gc-achievement-list')
export class AchievementList extends GameElement {
    static styles = styles

    @property({ type: Array }) achievements: Achievement[] = []

    render() {
        return html`<ul>${this.achievements.map((entry) => {
            const pct = entry.target && entry.progress !== undefined ? Math.min(1, entry.progress / entry.target) : entry.unlocked ? 1 : 0
            const hidden = entry.secret && !entry.unlocked
            return html`<li class=${entry.unlocked ? 'unlocked' : 'locked'}>
                <div class=${`icon ${entry.unlocked ? 'unlocked' : ''}`}>${hidden ? '?' : (entry.icon ?? '🏆')}</div>
                <div class="info">
                    <div class="name">${hidden ? 'Hidden' : entry.name}</div>
                    ${!hidden && entry.description ? html`<div class="desc">${entry.description}</div>` : nothing}
                    ${entry.target !== undefined ? html`<div class="bar">
                        <div><div style="width: ${pct * 100}%"></div></div>
                        <span style="font-size:11px;opacity:0.7">${entry.progress ?? 0}/${entry.target}</span>
                    </div>` : nothing}
                </div>
                ${entry.points !== undefined ? html`<div class="points">${entry.points}G</div>` : nothing}
            </li>`
        })}</ul>`
    }
}
