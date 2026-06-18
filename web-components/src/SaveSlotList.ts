const TAG_NAME = 'tc-save-slot-list'

export type SaveSlotMode = 'load' | 'save'
const MODES: SaveSlotMode[] = ['load', 'save']

export interface SaveSlot {
    id: string
    name?: string
    timestamp?: string
    location?: string
    level?: number
    playtime?: string
    empty?: boolean
    autosave?: boolean
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class SaveSlotList extends HTMLElement {
    private _initialised = false
    private _slots: SaveSlot[] = []

    onSelect: ((id: string) => void) | null = null
    onSave: ((id: string) => void) | null = null
    onLoad: ((id: string) => void) | null = null
    onDelete: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'mode']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
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

    get mode(): SaveSlotMode {
        const raw = this.getAttribute('mode')
        return MODES.includes(raw as SaveSlotMode) ? (raw as SaveSlotMode) : 'load'
    }
    set mode(v: SaveSlotMode) {
        this.setAttribute('mode', MODES.includes(v) ? v : 'load')
    }

    get slots(): SaveSlot[] {
        return this._slots.slice()
    }
    set slots(value: SaveSlot[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const selected = this.selectedId
        const mode = this.mode

        const rowsHtml = this._slots.map(s => {
            const isSelected = s.id === selected
            let rowCls = 'tc-save-slot-list-row'
            if (isSelected) rowCls += ' tc-save-slot-list-row--selected'
            if (s.empty) rowCls += ' tc-save-slot-list-row--empty'
            if (s.autosave) rowCls += ' tc-save-slot-list-row--autosave'

            const tabindex = s.empty && mode === 'load' ? '-1' : '0'

            const nameHtml = s.empty
                ? `<span class="tc-save-slot-list-name tc-save-slot-list-name--empty">Empty Slot</span>`
                : `<span class="tc-save-slot-list-name">${esc(s.name || 'Save')}</span>`

            const autosaveBadge = s.autosave
                ? `<span class="tc-save-slot-list-autosave-badge">Auto</span>`
                : ''

            const metaParts: string[] = []
            if (!s.empty) {
                if (typeof s.level === 'number') {
                    metaParts.push(`<span class="tc-save-slot-list-meta">Lv ${s.level}</span>`)
                }
                if (s.location) {
                    metaParts.push(`<span class="tc-save-slot-list-meta">${esc(s.location)}</span>`)
                }
                if (s.playtime) {
                    metaParts.push(`<span class="tc-save-slot-list-meta">${esc(s.playtime)}</span>`)
                }
                if (s.timestamp) {
                    metaParts.push(`<span class="tc-save-slot-list-timestamp">${esc(s.timestamp)}</span>`)
                }
            }
            const metaHtml = metaParts.length
                ? `<div class="tc-save-slot-list-meta-row">${metaParts.join('')}</div>`
                : ''

            const actions: string[] = []
            if (mode === 'save') {
                const label = s.empty ? 'Save' : 'Overwrite'
                actions.push(
                    `<button type="button" class="tc-save-slot-list-btn" data-action="save"${s.autosave ? ' disabled' : ''}>${label}</button>`
                )
                if (!s.empty && !s.autosave) {
                    actions.push(
                        `<button type="button" class="tc-save-slot-list-btn tc-save-slot-list-btn--danger" data-action="delete">Delete</button>`
                    )
                }
            } else {
                if (!s.empty) {
                    actions.push(
                        `<button type="button" class="tc-save-slot-list-btn" data-action="load">Load</button>`
                    )
                    if (!s.autosave) {
                        actions.push(
                            `<button type="button" class="tc-save-slot-list-btn tc-save-slot-list-btn--danger" data-action="delete">Delete</button>`
                        )
                    }
                }
            }

            return `<div role="option" tabindex="${tabindex}" class="${rowCls}" data-id="${esc(s.id)}" aria-selected="${isSelected ? 'true' : 'false'}">
                <div class="tc-save-slot-list-text">
                    <div class="tc-save-slot-list-header-row">
                        ${nameHtml}
                        ${autosaveBadge}
                    </div>
                    ${metaHtml}
                </div>
                <div class="tc-save-slot-list-actions">${actions.join('')}</div>
            </div>`
        }).join('')

        const emptyHtml = this._slots.length === 0
            ? `<p class="tc-save-slot-list-empty">No save slots available</p>`
            : ''

        this.innerHTML = `<div class="tc-save-slot-list-body">${rowsHtml}${emptyHtml}</div>`

        const body = this.querySelector<HTMLElement>('.tc-save-slot-list-body')
        if (!body) return

        body.addEventListener('click', (e: Event) => {
            const target = e.target as Element
            const btn = target.closest<HTMLButtonElement>('.tc-save-slot-list-btn')
            const row = target.closest<HTMLElement>('.tc-save-slot-list-row')
            if (!row) return
            const id = row.dataset.id ?? ''
            if (btn) {
                if (btn.disabled) return
                const action = btn.dataset.action ?? ''
                if (action === 'save') {
                    this.dispatchEvent(new CustomEvent('tc-save', { bubbles: true, composed: true, detail: { id } }))
                    if (typeof this.onSave === 'function') this.onSave(id)
                } else if (action === 'load') {
                    this.dispatchEvent(new CustomEvent('tc-load', { bubbles: true, composed: true, detail: { id } }))
                    if (typeof this.onLoad === 'function') this.onLoad(id)
                } else if (action === 'delete') {
                    this.dispatchEvent(new CustomEvent('tc-delete', { bubbles: true, composed: true, detail: { id } }))
                    if (typeof this.onDelete === 'function') this.onDelete(id)
                }
            } else {
                this.selectedId = id
                this.dispatchEvent(new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } }))
                if (typeof this.onSelect === 'function') this.onSelect(id)
            }
        })

        body.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter' && e.key !== ' ') return
            const target = e.target as Element
            if (target.closest('button')) return
            const row = target.closest<HTMLElement>('.tc-save-slot-list-row')
            if (!row) return
            e.preventDefault()
            const id = row.dataset.id ?? ''
            this.selectedId = id
            this.dispatchEvent(new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } }))
            if (typeof this.onSelect === 'function') this.onSelect(id)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SaveSlotList
    }
}
