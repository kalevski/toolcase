const TAG_NAME = 'gc-list'

export interface GcListItem {
    id: string
    label?: string
    icon?: string
    meta?: string
    disabled?: boolean
}

export interface GcListEventMap {
    select: CustomEvent<{ id: string }>
}

export class GcList extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    private _items: GcListItem[] = []

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

    get items(): GcListItem[] {
        return this._items
    }
    set items(value: GcListItem[]) {
        this._items = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(value: string) {
        if (value) this.setAttribute('selected-id', value)
        else this.removeAttribute('selected-id')
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
        const itemMarkup = this._items.map((item) => {
            const isSelected = item.id === selected
            const cls = `gc-list-item${isSelected ? ' is-selected' : ''}${item.disabled ? ' is-disabled' : ''}`
            const iconMarkup = item.icon
                ? (item.icon.startsWith('bi-') || item.icon.startsWith('bi ')
                    ? `<i class="gc-list-item-icon ${this.escape(item.icon.startsWith('bi ') ? item.icon : `bi ${item.icon}`)}"></i>`
                    : `<span class="gc-list-item-icon">${this.escape(item.icon)}</span>`)
                : ''
            const labelMarkup = item.label != null
                ? `<span class="gc-list-item-label">${this.escape(item.label)}</span>`
                : ''
            const metaMarkup = item.meta
                ? `<span class="gc-list-item-meta">${this.escape(item.meta)}</span>`
                : ''
            const ariaSelected = isSelected ? 'true' : 'false'
            const ariaDisabled = item.disabled ? ' aria-disabled="true"' : ''
            const tabindex = item.disabled ? '-1' : '0'
            return `<div role="option" tabindex="${tabindex}" aria-selected="${ariaSelected}"${ariaDisabled} class="${cls}" data-id="${this.escape(item.id)}">${iconMarkup}${labelMarkup}${metaMarkup}</div>`
        }).join('')
        this.innerHTML = itemMarkup

        this.querySelectorAll<HTMLElement>('.gc-list-item').forEach((el) => {
            const handle = () => {
                const id = el.dataset.id || ''
                const item = this._items.find((i) => i.id === id)
                if (!item || item.disabled) return
                this.selectedId = id
                this.emit('select', { id })
            }
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                handle()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GcList
    }
}
