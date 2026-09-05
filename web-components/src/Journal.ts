import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-journal'

export type JournalState = 'active' | 'completed' | 'failed' | 'inactive'
const STATES: JournalState[] = ['active', 'completed', 'failed', 'inactive']

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
    state?: JournalState
    rewards?: JournalReward[]
}

function normaliseState(raw: JournalState | undefined): JournalState {
    return raw && STATES.includes(raw) ? raw : 'active'
}

// tc-journal — quest / lore journal with an entry list and a detail view.
// Port of gc-journal (game-components); restyled to the slate/ink design system
// with sharp corners, JetBrains Mono machine-facing text, 1px hairline borders,
// and all cosmetics driven through --bs-journal-* custom properties.
export class Journal extends HTMLElement {
    private _initialised = false
    private _entries: JournalEntry[] = []

    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id']
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
        if (this._initialised) this.render()
    }

    private render(): void {
        const selected = this.selectedId
        const active = this._entries.find((e) => e.id === selected) ?? null

        const rowsHtml = this._entries
            .map((e) => {
                const state = normaliseState(e.state)
                const isSelected = e.id === selected
                let rowCls = `tc-journal-row tc-journal-row--${state}`
                if (isSelected) rowCls += ' tc-journal-row--selected'
                return `<div role="option" tabindex="0" class="${rowCls}" data-id="${esc(e.id)}" aria-selected="${isSelected ? 'true' : 'false'}">
                <span class="tc-journal-row-pip" aria-hidden="true"></span>
                <span class="tc-journal-row-title">${esc(e.title)}</span>
            </div>`
            })
            .join('')

        const listHtml = this._entries.length
            ? `<div class="tc-journal-list" role="listbox">${rowsHtml}</div>`
            : `<div class="tc-journal-list" role="listbox"><p class="tc-journal-list-empty">No journal entries</p></div>`

        const detailHtml = active
            ? this.renderDetail(active)
            : `<p class="tc-journal-detail-empty">Select a journal entry.</p>`

        patchHtml(
            this,
            `<div class="tc-journal">
            ${listHtml}
            <div class="tc-journal-detail">${detailHtml}</div>
        </div>`,
        )

        const list = this.querySelector<HTMLElement>('.tc-journal-list')
        if (!list) return

        bindOnce(list, 'click', (event: Event) => {
            const row = (event.target as Element).closest<HTMLElement>('.tc-journal-row')
            if (!row) return
            this._selectRow(row.dataset.id ?? '')
        })

        bindOnce(list, 'keydown', (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            const row = (event.target as Element).closest<HTMLElement>('.tc-journal-row')
            if (!row) return
            event.preventDefault()
            this._selectRow(row.dataset.id ?? '')
        })
    }

    private _selectRow(id: string): void {
        this.selectedId = id
        this.dispatchEvent(
            new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private renderDetail(entry: JournalEntry): string {
        const state = normaliseState(entry.state)
        const stateLabel = state.charAt(0).toUpperCase() + state.slice(1)

        const description = entry.description
            ? `<p class="tc-journal-detail-description">${esc(entry.description)}</p>`
            : ''
        const body = entry.body ? `<p class="tc-journal-detail-body">${esc(entry.body)}</p>` : ''

        const objectivesHtml = (entry.objectives || [])
            .map((o) => {
                let cls = 'tc-journal-objective'
                if (o.completed) cls += ' tc-journal-objective--completed'
                if (o.optional) cls += ' tc-journal-objective--optional'
                const checkCls = o.completed
                    ? 'tc-journal-objective-check tc-journal-objective-check--done'
                    : 'tc-journal-objective-check'
                const optionalHtml = o.optional
                    ? `<span class="tc-journal-objective-optional">(optional)</span>`
                    : ''
                return `<div class="${cls}" data-id="${esc(o.id)}">
                <span class="${checkCls}" aria-hidden="true"></span>
                <span class="tc-journal-objective-label">${esc(o.label)}</span>
                ${optionalHtml}
            </div>`
            })
            .join('')
        const objectivesBlock = objectivesHtml
            ? `<div class="tc-journal-detail-section">
                <span class="tc-journal-detail-eyebrow">Objectives</span>
                <div class="tc-journal-objectives">${objectivesHtml}</div>
            </div>`
            : ''

        const rewardsHtml = (entry.rewards || [])
            .map((r) => {
                const value = typeof r.value === 'number' ? r.value.toLocaleString() : r.value
                const iconHtml = r.icon
                    ? `<span class="tc-journal-reward-icon" aria-hidden="true">${esc(r.icon)}</span>`
                    : ''
                return `<div class="tc-journal-reward">
                ${iconHtml}
                <span class="tc-journal-reward-label">${esc(r.label)}</span>
                <span class="tc-journal-reward-value">${esc(value)}</span>
            </div>`
            })
            .join('')
        const rewardsBlock = rewardsHtml
            ? `<div class="tc-journal-detail-section">
                <span class="tc-journal-detail-eyebrow">Rewards</span>
                <div class="tc-journal-rewards">${rewardsHtml}</div>
            </div>`
            : ''

        return `<span class="tc-journal-detail-state tc-journal-detail-state--${state}">${esc(stateLabel)}</span>
            <h3 class="tc-journal-detail-title">${esc(entry.title)}</h3>
            ${description}
            ${body}
            ${objectivesBlock}
            ${rewardsBlock}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Journal
    }
}
