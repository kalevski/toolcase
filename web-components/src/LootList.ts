const TAG_NAME = 'tc-loot-list'

export type LootItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
const RARITIES: LootItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

export interface LootItem {
    id: string
    name?: string
    icon?: string
    rarity?: LootItemRarity
    qty?: number
}

export interface LootEntry {
    item: LootItem
    qty?: number
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class LootList extends HTMLElement {
    private _initialised = false
    private _items: LootEntry[] = []

    onTake: ((id: string) => void) | null = null
    onTakeAll: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['list-title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private render(): void {
        const rowsHtml = this._items.map(entry => {
            const icon = entry.item.icon ?? '◆'
            const name = entry.item.name ?? entry.item.id
            const rarity = entry.item.rarity ?? ''
            const qty = entry.qty ?? entry.item.qty ?? 1
            const qtyHtml = qty > 1
                ? `<span class="tc-loot-list-qty" aria-label="quantity ${qty}">×${qty}</span>`
                : ''
            const rarityCls = RARITIES.includes(rarity as LootItemRarity)
                ? ` tc-loot-list-row--${rarity}`
                : ''
            return `<div class="tc-loot-list-row${rarityCls}" data-id="${esc(entry.item.id)}">
                <span class="tc-loot-list-icon" aria-hidden="true">${esc(icon)}</span>
                <span class="tc-loot-list-name">${esc(name)}</span>
                ${qtyHtml}
                <button type="button" class="tc-loot-list-btn tc-loot-list-take" data-action="take">Take</button>
            </div>`
        }).join('')

        const emptyHtml = this._items.length === 0
            ? `<p class="tc-loot-list-empty">No loot available</p>`
            : ''

        const allDisabled = this._items.length === 0 ? ' disabled' : ''

        this.innerHTML = `<div class="tc-loot-list">
            <div class="tc-loot-list-header">
                <span class="tc-loot-list-title">${esc(this.listTitle)}</span>
                <button type="button" class="tc-loot-list-btn tc-loot-list-take-all" data-action="take-all"${allDisabled}>Take All</button>
            </div>
            <div class="tc-loot-list-rows">${rowsHtml}${emptyHtml}</div>
        </div>`

        const container = this.querySelector<HTMLElement>('.tc-loot-list')
        if (container) {
            container.addEventListener('click', (e: Event) => {
                const btn = (e.target as Element).closest<HTMLButtonElement>('[data-action]')
                if (!btn || btn.disabled) return
                const action = btn.dataset.action
                if (action === 'take') {
                    const row = btn.closest<HTMLElement>('.tc-loot-list-row')
                    if (!row) return
                    const id = row.dataset.id ?? ''
                    this.dispatchEvent(new CustomEvent('tc-take', {
                        bubbles: true,
                        composed: true,
                        detail: { id },
                    }))
                    if (typeof this.onTake === 'function') this.onTake(id)
                } else if (action === 'take-all') {
                    this.dispatchEvent(new CustomEvent('tc-take-all', {
                        bubbles: true,
                        composed: true,
                        detail: {},
                    }))
                    if (typeof this.onTakeAll === 'function') this.onTakeAll()
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LootList
    }
}
