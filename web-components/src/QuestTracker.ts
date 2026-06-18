const TAG_NAME = 'tc-quest-tracker'

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

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class QuestTracker extends HTMLElement {
    private _initialised = false
    private _quests: QuestEntry[] = []

    static get observedAttributes(): string[] {
        return ['tracker-title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private render(): void {
        const questsHtml = this._quests.map(q => {
            const objectivesHtml = q.objectives.map(o => {
                const hasProgress =
                    typeof o.progress === 'number' &&
                    typeof o.target === 'number' &&
                    o.target > 0
                const pct = hasProgress
                    ? Math.max(0, Math.min(100, ((o.progress as number) / (o.target as number)) * 100))
                    : 0

                const stateCls = [
                    o.completed ? ' tc-quest-tracker-objective--completed' : '',
                    o.optional ? ' tc-quest-tracker-objective--optional' : '',
                ].join('')

                const checkHtml = o.completed
                    ? `<span class="tc-quest-tracker-objective-check tc-quest-tracker-objective-check--done" aria-hidden="true"></span>`
                    : `<span class="tc-quest-tracker-objective-check" aria-hidden="true"></span>`

                const progressCountHtml = hasProgress
                    ? `<span class="tc-quest-tracker-objective-count">${o.progress}/${o.target}</span>`
                    : ''

                const progressBarHtml = hasProgress
                    ? `<div class="tc-quest-tracker-objective-bar" role="progressbar" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
                            <div class="tc-quest-tracker-objective-bar-fill" style="width:${pct.toFixed(2)}%"></div>
                        </div>`
                    : ''

                const optionalHtml = o.optional
                    ? `<span class="tc-quest-tracker-objective-optional">(optional)</span>`
                    : ''

                return `<div class="tc-quest-tracker-objective${stateCls}" data-id="${esc(o.id)}">
                    <div class="tc-quest-tracker-objective-row">
                        ${checkHtml}
                        <span class="tc-quest-tracker-objective-label">${esc(o.label)}</span>
                        ${optionalHtml}
                        ${progressCountHtml}
                    </div>
                    ${progressBarHtml}
                </div>`
            }).join('')

            return `<div class="tc-quest-tracker-quest" data-id="${esc(q.id)}">
                <div class="tc-quest-tracker-quest-name">${esc(q.name)}</div>
                <div class="tc-quest-tracker-objectives">${objectivesHtml}</div>
            </div>`
        }).join('')

        const emptyHtml = this._quests.length === 0
            ? `<p class="tc-quest-tracker-empty">No active quests</p>`
            : ''

        this.innerHTML = `<div class="tc-quest-tracker">
            <div class="tc-quest-tracker-header">
                <span class="tc-quest-tracker-title">${esc(this.trackerTitle)}</span>
            </div>
            <div class="tc-quest-tracker-quests">${questsHtml}${emptyHtml}</div>
        </div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QuestTracker
    }
}
