const TAG_NAME = 'gc-save-slot-list'

export type SaveSlotMode = 'load' | 'save'

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

export interface SaveSlotListEventMap {
    select: CustomEvent<{ id: string }>
    save: CustomEvent<{ id: string }>
    load: CustomEvent<{ id: string }>
    delete: CustomEvent<{ id: string }>
}

export class SaveSlotList extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id', 'mode']
    }

    private _slots: SaveSlot[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'listbox')
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

    get mode(): SaveSlotMode {
        const raw = this.getAttribute('mode')
        return raw === 'save' ? 'save' : 'load'
    }
    set mode(v: SaveSlotMode) {
        this.setAttribute('mode', v)
    }

    get slots(): SaveSlot[] {
        return this._slots.slice()
    }
    set slots(value: SaveSlot[]) {
        this._slots = Array.isArray(value) ? value.slice() : []
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
        const mode = this.mode

        const rowsMarkup = this._slots.map((s) => {
            const isSelected = s.id === selected
            const cls = `gc-save-slot-list-row${isSelected ? ' is-selected' : ''}${s.empty ? ' is-empty' : ''}${s.autosave ? ' is-autosave' : ''}`
            const tabindex = s.empty && mode === 'load' ? '-1' : '0'

            const nameMarkup = s.empty
                ? `<span class="gc-save-slot-list-name is-empty-label">Empty Slot</span>`
                : `<span class="gc-save-slot-list-name">${this.escape(s.name || 'Save')}</span>`
            const autosaveBadge = s.autosave
                ? `<span class="gc-save-slot-list-autosave">Auto</span>`
                : ''

            const meta: string[] = []
            if (!s.empty) {
                if (typeof s.level === 'number') meta.push(`<span class="gc-save-slot-list-meta">Lv ${s.level}</span>`)
                if (s.location) meta.push(`<span class="gc-save-slot-list-meta">${this.escape(s.location)}</span>`)
                if (s.playtime) meta.push(`<span class="gc-save-slot-list-meta">${this.escape(s.playtime)}</span>`)
                if (s.timestamp) meta.push(`<span class="gc-save-slot-list-time">${this.escape(s.timestamp)}</span>`)
            }
            const metaBlock = meta.length ? `<div class="gc-save-slot-list-meta-row">${meta.join('')}</div>` : ''

            const actions: string[] = []
            if (mode === 'save') {
                actions.push(`<button type="button" class="gc-save-slot-list-action" data-action="save" ${s.autosave ? 'disabled' : ''}>${s.empty ? 'Save' : 'Overwrite'}</button>`)
                if (!s.empty && !s.autosave) {
                    actions.push(`<button type="button" class="gc-save-slot-list-action is-danger" data-action="delete">Delete</button>`)
                }
            } else {
                if (!s.empty) {
                    actions.push(`<button type="button" class="gc-save-slot-list-action" data-action="load">Load</button>`)
                    if (!s.autosave) {
                        actions.push(`<button type="button" class="gc-save-slot-list-action is-danger" data-action="delete">Delete</button>`)
                    }
                }
            }

            return `<div role="option" tabindex="${tabindex}" class="${cls}" data-id="${this.escape(s.id)}" aria-selected="${isSelected ? 'true' : 'false'}">
                <div class="gc-save-slot-list-text">
                    <div class="gc-save-slot-list-header-row">
                        ${nameMarkup}
                        ${autosaveBadge}
                    </div>
                    ${metaBlock}
                </div>
                <div class="gc-save-slot-list-actions">${actions.join('')}</div>
            </div>`
        }).join('')

        this.innerHTML = rowsMarkup

        this.querySelectorAll<HTMLElement>('.gc-save-slot-list-row').forEach((el) => {
            const id = el.dataset.id || ''
            el.addEventListener('click', (event) => {
                if ((event.target as HTMLElement).closest('button')) return
                this.selectedId = id
                this.emit('select', { id })
            })
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                if ((event.target as HTMLElement).closest('button')) return
                event.preventDefault()
                this.selectedId = id
                this.emit('select', { id })
            })
        })

        this.querySelectorAll<HTMLButtonElement>('.gc-save-slot-list-action').forEach((el) => {
            el.addEventListener('click', (event) => {
                event.stopPropagation()
                const row = el.closest('.gc-save-slot-list-row') as HTMLElement | null
                if (!row) return
                const id = row.dataset.id || ''
                const action = el.dataset.action || ''
                if (action === 'save' || action === 'load' || action === 'delete') {
                    this.emit(action, { id })
                }
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, SaveSlotList)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SaveSlotList
    }
}
