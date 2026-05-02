const TAG_NAME = 'gc-achievement-list'

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

export class AchievementList extends HTMLElement {

    static get observedAttributes(): string[] {
        return []
    }

    private _achievements: Achievement[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    get achievements(): Achievement[] {
        return this._achievements.slice()
    }
    set achievements(value: Achievement[]) {
        this._achievements = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        const rowsMarkup = this._achievements.map((a) => {
            const isSecret = a.secret && !a.unlocked
            const hasProgress = !a.unlocked && typeof a.progress === 'number' && typeof a.target === 'number' && a.target > 0
            const stateCls = a.unlocked ? ' is-unlocked' : (hasProgress ? ' is-in-progress' : ' is-locked')
            const cls = `gc-achievement-list-row${stateCls}${isSecret ? ' is-secret' : ''}`

            const icon = a.unlocked ? (a.icon || '◆') : (isSecret ? '?' : (a.icon || '◇'))
            const name = isSecret ? '???' : this.escape(a.name)
            const description = isSecret
                ? 'Hidden achievement.'
                : (a.description ? this.escape(a.description) : '')
            const descMarkup = description
                ? `<span class="gc-achievement-list-description">${description}</span>`
                : ''
            const pointsMarkup = (typeof a.points === 'number' && !isSecret)
                ? `<span class="gc-achievement-list-points">${a.points}</span>`
                : ''
            let progressMarkup = ''
            if (hasProgress) {
                const pct = Math.max(0, Math.min(100, ((a.progress as number) / (a.target as number)) * 100))
                progressMarkup = `
                    <div class="gc-achievement-list-progress">
                        <div class="gc-achievement-list-progress-bar"><div class="gc-achievement-list-progress-fill" style="width:${pct.toFixed(2)}%;"></div></div>
                        <span class="gc-achievement-list-progress-count">${a.progress}/${a.target}</span>
                    </div>
                `
            }
            return `<div role="listitem" class="${cls}" data-id="${this.escape(a.id)}">
                <div class="gc-achievement-list-icon">${this.escape(icon)}</div>
                <div class="gc-achievement-list-text">
                    <span class="gc-achievement-list-name">${name}</span>
                    ${descMarkup}
                    ${progressMarkup}
                </div>
                ${pointsMarkup}
            </div>`
        }).join('')

        this.innerHTML = rowsMarkup
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AchievementList
    }
}
