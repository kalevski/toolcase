const TAG_NAME = 'gc-journal'

export interface JournalObjective {
    id: string
    label: string
    completed?: boolean
    optional?: boolean
}

export interface JournalReward {
    label: string
    value: string | number
    icon?: string
}

export interface JournalEntry {
    id: string
    title: string
    description?: string
    body?: string
    objectives?: JournalObjective[]
    state?: 'active' | 'completed' | 'failed' | 'inactive'
    rewards?: JournalReward[]
}

export interface JournalEventMap {
    select: CustomEvent<{ id: string }>
}

export class Journal extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    private _entries: JournalEntry[] = []

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

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    get entries(): JournalEntry[] {
        return this._entries.slice()
    }
    set entries(value: JournalEntry[]) {
        this._entries = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
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
        const selected = this.selectedId
        const active = this._entries.find((e) => e.id === selected) ?? null

        const rowsMarkup = this._entries.map((e) => {
            const state = e.state ?? 'active'
            const isSelected = e.id === selected
            const cls = `gc-journal-row is-${state}${isSelected ? ' is-selected' : ''}`
            return `<div role="listitem" tabindex="0" class="${cls}" data-id="${this.escape(e.id)}">
                <span class="gc-journal-row-state-pip"></span>
                <span class="gc-journal-row-title">${this.escape(e.title)}</span>
            </div>`
        }).join('')

        const detailMarkup = active
            ? this.renderDetail(active)
            : `<div class="gc-journal-detail-empty">Select a journal entry.</div>`

        this.innerHTML = `
            <div class="gc-journal-list" role="list">${rowsMarkup}</div>
            <div class="gc-journal-detail">${detailMarkup}</div>
        `

        this.querySelectorAll<HTMLElement>('.gc-journal-row').forEach((el) => {
            const id = el.dataset.id || ''
            const fire = () => {
                this.selectedId = id
                this.emit('select', { id })
            }
            el.addEventListener('click', fire)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                fire()
            })
        })
    }

    private renderDetail(entry: JournalEntry): string {
        const state = entry.state ?? 'active'
        const stateLabel = state.charAt(0).toUpperCase() + state.slice(1)
        const description = entry.description
            ? `<p class="gc-journal-detail-description">${this.escape(entry.description)}</p>`
            : ''
        const body = entry.body
            ? `<p class="gc-journal-detail-body">${this.escape(entry.body)}</p>`
            : ''
        const objectives = (entry.objectives || []).map((o) => {
            const cls = `gc-journal-detail-objective${o.completed ? ' is-completed' : ''}${o.optional ? ' is-optional' : ''}`
            const checkbox = o.completed ? '☑' : '☐'
            return `<div class="${cls}">
                <span class="gc-journal-detail-objective-check">${checkbox}</span>
                <span class="gc-journal-detail-objective-label">${this.escape(o.label)}</span>
            </div>`
        }).join('')
        const objectivesBlock = objectives
            ? `<div class="gc-journal-detail-objectives"><gc-eyebrow>Objectives</gc-eyebrow>${objectives}</div>`
            : ''
        const rewards = (entry.rewards || []).map((r) => {
            const value = typeof r.value === 'number' ? r.value.toLocaleString() : r.value
            const iconMarkup = r.icon ? `<span class="gc-journal-detail-reward-icon">${this.escape(r.icon)}</span>` : ''
            return `<div class="gc-journal-detail-reward">
                ${iconMarkup}
                <span class="gc-journal-detail-reward-label">${this.escape(r.label)}</span>
                <span class="gc-journal-detail-reward-value">${this.escape(value)}</span>
            </div>`
        }).join('')
        const rewardsBlock = rewards
            ? `<div class="gc-journal-detail-rewards"><gc-eyebrow>Rewards</gc-eyebrow>${rewards}</div>`
            : ''
        return `
            <gc-eyebrow class="gc-journal-detail-state is-${state}">${stateLabel}</gc-eyebrow>
            <gc-title class="gc-journal-detail-title">${this.escape(entry.title)}</gc-title>
            ${description}
            ${body}
            ${objectivesBlock}
            ${rewardsBlock}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Journal)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Journal
    }
}
