import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-loot-list'

export interface LootEntry {
    item: InventoryItem
    qty?: number
}

export interface LootListEventMap {
    take: CustomEvent<{ id: string }>
    'take-all': CustomEvent<void>
}

export class LootList extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['list-title']
    }

    private _items: LootEntry[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get listTitle(): string {
        return this.getAttribute('list-title') ?? 'Loot'
    }
    set listTitle(v: string) {
        if (v) this.setAttribute('list-title', v)
        else this.removeAttribute('list-title')
    }

    get items(): LootEntry[] {
        return this._items.slice()
    }
    set items(value: LootEntry[]) {
        this._items = Array.isArray(value) ? value.slice() : []
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
        const rowsMarkup = this._items.map((entry) => {
            const icon = entry.item.icon || '◆'
            const name = entry.item.name ?? entry.item.id
            const rarity = entry.item.rarity ?? ''
            const qty = entry.qty ?? entry.item.qty ?? 1
            const qtyMarkup = qty > 1
                ? `<span class="gc-loot-list-qty">×${qty}</span>`
                : ''
            const rarityCls = rarity ? ` is-${rarity}` : ''
            return `<div role="listitem" class="gc-loot-list-row${rarityCls}" data-id="${this.escape(entry.item.id)}">
                <span class="gc-loot-list-icon">${this.escape(icon)}</span>
                <span class="gc-loot-list-name">${this.escape(name)}</span>
                ${qtyMarkup}
                <button type="button" class="gc-loot-list-take">Take</button>
            </div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-loot-list-header">
                <gc-eyebrow class="gc-loot-list-eyebrow">${this.escape(this.listTitle)}</gc-eyebrow>
                <button type="button" class="gc-loot-list-take-all" ${this._items.length === 0 ? 'disabled' : ''}>Take All</button>
            </div>
            <div class="gc-loot-list-rows">${rowsMarkup}</div>
        `

        this.querySelectorAll<HTMLButtonElement>('.gc-loot-list-take').forEach((el) => {
            el.addEventListener('click', () => {
                const row = el.closest('.gc-loot-list-row') as HTMLElement | null
                if (!row) return
                const id = row.dataset.id || ''
                this.emit('take', { id })
            })
        })

        const takeAllBtn = this.querySelector('.gc-loot-list-take-all') as HTMLButtonElement | null
        if (takeAllBtn) {
            takeAllBtn.addEventListener('click', () => {
                this.emit('take-all')
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LootList
    }
}
