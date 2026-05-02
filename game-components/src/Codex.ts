const TAG_NAME = 'gc-codex'

export interface CodexEntry {
    id: string
    name: string
    icon?: string
    discovered?: boolean
    description?: string
    stats?: { label: string, value: string | number }[]
}

export interface CodexEventMap {
    select: CustomEvent<{ id: string }>
}

export class Codex extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    private _entries: CodexEntry[] = []

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

    get entries(): CodexEntry[] {
        return this._entries.slice()
    }
    set entries(value: CodexEntry[]) {
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
            const isSelected = e.id === selected
            const cls = `gc-codex-row${isSelected ? ' is-selected' : ''}${e.discovered ? '' : ' is-undiscovered'}`
            const icon = e.discovered ? (e.icon || '◆') : '?'
            const name = e.discovered ? this.escape(e.name) : '???'
            return `<div role="listitem" tabindex="0" class="${cls}" data-id="${this.escape(e.id)}">
                <span class="gc-codex-row-glyph">${this.escape(icon)}</span>
                <span class="gc-codex-row-name">${name}</span>
            </div>`
        }).join('')

        const detailMarkup = active
            ? this.renderDetail(active)
            : `<div class="gc-codex-detail-empty">Select an entry.</div>`

        this.innerHTML = `
            <div class="gc-codex-list" role="list">${rowsMarkup}</div>
            <div class="gc-codex-detail">${detailMarkup}</div>
        `

        this.querySelectorAll<HTMLElement>('.gc-codex-row').forEach((el) => {
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

    private renderDetail(entry: CodexEntry): string {
        if (!entry.discovered) {
            return `
                <gc-eyebrow class="gc-codex-detail-eyebrow">Codex</gc-eyebrow>
                <gc-title class="gc-codex-detail-name">???</gc-title>
                <p class="gc-codex-detail-description">Undiscovered.</p>
            `
        }
        const description = entry.description
            ? `<p class="gc-codex-detail-description">${this.escape(entry.description)}</p>`
            : ''
        const stats = (entry.stats || []).map((s) => {
            const value = typeof s.value === 'number' ? s.value.toLocaleString() : s.value
            return `<div class="gc-codex-detail-stat">
                <span class="gc-codex-detail-stat-label">${this.escape(s.label)}</span>
                <span class="gc-codex-detail-stat-value">${this.escape(value)}</span>
            </div>`
        }).join('')
        const statsBlock = stats
            ? `<div class="gc-codex-detail-stats">${stats}</div>`
            : ''
        return `
            <gc-eyebrow class="gc-codex-detail-eyebrow">Codex</gc-eyebrow>
            <gc-title class="gc-codex-detail-name">${this.escape(entry.name)}</gc-title>
            ${description}
            ${statsBlock}
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, Codex)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Codex
    }
}
