const TAG_NAME = 'gc-quest-tracker'

export interface QuestObjective {
    id: string
    label: string
    progress?: number
    target?: number
    completed?: boolean
    optional?: boolean
}

export interface QuestEntry {
    id: string
    name: string
    objectives: QuestObjective[]
}

export class QuestTracker extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['tracker-title']
    }

    private _quests: QuestEntry[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get trackerTitle(): string {
        return this.getAttribute('tracker-title') ?? 'Active Quests'
    }
    set trackerTitle(v: string) {
        if (v) this.setAttribute('tracker-title', v)
        else this.removeAttribute('tracker-title')
    }

    get quests(): QuestEntry[] {
        return this._quests.slice()
    }
    set quests(value: QuestEntry[]) {
        this._quests = Array.isArray(value) ? value.slice() : []
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
        const questsMarkup = this._quests.map((q) => {
            const objectives = q.objectives.map((o) => {
                const cls = `gc-quest-tracker-objective${o.completed ? ' is-completed' : ''}${o.optional ? ' is-optional' : ''}`
                const checkbox = o.completed ? '☑' : '☐'
                const hasProgress = typeof o.progress === 'number' && typeof o.target === 'number' && o.target > 0
                const progressPct = hasProgress ? Math.max(0, Math.min(100, ((o.progress as number) / (o.target as number)) * 100)) : 0
                const progressLabel = hasProgress
                    ? `<span class="gc-quest-tracker-objective-count">${o.progress}/${o.target}</span>`
                    : ''
                const progressBar = hasProgress
                    ? `<div class="gc-quest-tracker-objective-bar"><div class="gc-quest-tracker-objective-bar-fill" style="width:${progressPct.toFixed(2)}%;"></div></div>`
                    : ''
                return `<div class="${cls}">
                    <div class="gc-quest-tracker-objective-row">
                        <span class="gc-quest-tracker-objective-check">${checkbox}</span>
                        <span class="gc-quest-tracker-objective-label">${this.escape(o.label)}</span>
                        ${progressLabel}
                    </div>
                    ${progressBar}
                </div>`
            }).join('')
            return `<div class="gc-quest-tracker-quest" data-id="${this.escape(q.id)}">
                <div class="gc-quest-tracker-quest-name">◆ ${this.escape(q.name)}</div>
                ${objectives}
            </div>`
        }).join('')

        this.innerHTML = `
            <gc-eyebrow class="gc-quest-tracker-eyebrow">${this.escape(this.trackerTitle)}</gc-eyebrow>
            <div class="gc-quest-tracker-quests">${questsMarkup}</div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QuestTracker
    }
}
