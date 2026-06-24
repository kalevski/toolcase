import { isImageSrc } from './internal/image'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-crafting-panel'

export interface CraftingItem {
    id: string
    name?: string
    icon?: string
}

export interface CraftingIngredient {
    item: CraftingItem
    qty: number
    available?: number
}

export interface CraftingRecipe {
    id: string
    name: string
    icon?: string
    inputs: CraftingIngredient[]
    output: { item: CraftingItem; qty?: number }
}

export interface CraftingPanelEventMap {
    'tc-select': CustomEvent<{ id: string }>
    'tc-craft': CustomEvent<{ id: string }>
}

// A recipe/item icon that looks like an image source is rendered as an <img>;
// otherwise the string is treated as a short glyph/initials label inside the
// sharp icon tile (mirrors the tc-character-select portrait pattern — the
// design system forbids emoji-as-icon, so free-form data glyphs stay content).

export class CraftingPanel extends HTMLElement {
    private _initialised = false
    private _recipes: CraftingRecipe[] = []

    /** Optional callbacks fired alongside the matching CustomEvents. */
    onSelect: ((id: string) => void) | null = null
    onCraft: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id', 'crafting']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
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

    get crafting(): boolean {
        return this.hasAttribute('crafting')
    }
    set crafting(v: boolean) {
        if (v) this.setAttribute('crafting', '')
        else this.removeAttribute('crafting')
    }

    get recipes(): CraftingRecipe[] {
        return this._recipes.slice()
    }
    set recipes(value: CraftingRecipe[]) {
        this._recipes = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private emit(name: string, id: string): void {
        this.dispatchEvent(new CustomEvent(name, { detail: { id }, bubbles: true, composed: true }))
    }

    private isAffordable(recipe: CraftingRecipe): boolean {
        return recipe.inputs.every((ing) => {
            if (typeof ing.available !== 'number') return true
            return ing.available >= ing.qty
        })
    }

    private _rowFor(target: EventTarget | null): HTMLElement | null {
        if (!(target instanceof HTMLElement)) return null
        const row = target.closest<HTMLElement>('.tc-crafting-panel-row')
        if (!row || !this.contains(row)) return null
        return row
    }

    private _select(id: string): void {
        this.selectedId = id
        this.emit('tc-select', id)
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _craft(id: string): void {
        this.emit('tc-craft', id)
        if (typeof this.onCraft === 'function') this.onCraft(id)
    }

    private _onClick = (e: MouseEvent): void => {
        if (!(e.target instanceof HTMLElement)) return
        const btn = e.target.closest<HTMLButtonElement>('.tc-crafting-panel-craft')
        if (btn && this.contains(btn) && !btn.disabled) {
            const id = btn.dataset.id
            if (id != null) this._craft(id)
            return
        }
        const row = this._rowFor(e.target)
        if (row) {
            const id = row.dataset.id
            if (id != null) this._select(id)
        }
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const row = this._rowFor(e.target)
        if (!row) return
        e.preventDefault()
        const id = row.dataset.id
        if (id != null) this._select(id)
    }

    // Sharp icon tile: <img> when the icon looks like an image source, otherwise
    // a short glyph/initials label derived from the icon string or the item name.
    private _iconTile(cls: string, iconStr: string | undefined, fallbackName: string): string {
        if (iconStr && isImageSrc(iconStr)) {
            return `<span class="${cls}"><img src="${esc(iconStr)}" alt="" /></span>`
        }
        const glyph = iconStr || (fallbackName ? fallbackName.charAt(0).toUpperCase() : '?')
        return `<span class="${cls}" aria-hidden="true">${esc(glyph)}</span>`
    }

    private _ingredientMarkup(ing: CraftingIngredient): string {
        const name = ing.item.name ?? ing.item.id
        const have = typeof ing.available === 'number' ? ing.available : null
        const insufficient = have != null && have < ing.qty
        const cls = `tc-crafting-panel-ingredient${insufficient ? ' is-insufficient' : ''}`
        const qtyText = have != null ? `${have}/${ing.qty}` : `${ing.qty}`
        return (
            `<div class="${cls}">` +
            this._iconTile('tc-crafting-panel-ingredient-icon', ing.item.icon, name) +
            `<span class="tc-crafting-panel-ingredient-name">${esc(name)}</span>` +
            `<span class="tc-crafting-panel-ingredient-qty">${esc(qtyText)}</span>` +
            `</div>`
        )
    }

    private _detailMarkup(recipe: CraftingRecipe, crafting: boolean): string {
        const affordable = this.isAffordable(recipe)
        const ingredients = recipe.inputs.map((ing) => this._ingredientMarkup(ing)).join('')
        const outputName = recipe.output.item.name ?? recipe.output.item.id
        const outputQty = recipe.output.qty ?? 1
        const disabled = !affordable || crafting
        const btnLabel = crafting ? 'Crafting…' : 'Craft'
        return (
            `<span class="tc-crafting-panel-eyebrow">Output</span>` +
            `<div class="tc-crafting-panel-output">` +
            this._iconTile('tc-crafting-panel-output-icon', recipe.output.item.icon, outputName) +
            `<span class="tc-crafting-panel-output-name">${esc(outputName)}</span>` +
            `<span class="tc-crafting-panel-output-qty">×${esc(String(outputQty))}</span>` +
            `</div>` +
            `<span class="tc-crafting-panel-eyebrow">Inputs</span>` +
            `<div class="tc-crafting-panel-ingredients">${ingredients}</div>` +
            `<button type="button" class="tc-crafting-panel-craft" data-id="${esc(recipe.id)}"${disabled ? ' disabled' : ''}>${btnLabel}</button>`
        )
    }

    private render(): void {
        this.classList.add('tc-crafting-panel')

        const selected = this.selectedId
        const crafting = this.crafting
        const active = this._recipes.find((r) => r.id === selected) ?? null

        const rowsMarkup = this._recipes
            .map((r) => {
                const isSelected = r.id === selected
                const affordable = this.isAffordable(r)
                const classes = ['tc-crafting-panel-row']
                if (isSelected) classes.push('is-selected')
                if (!affordable) classes.push('is-unaffordable')
                const name = r.name
                return (
                    `<div role="listitem" tabindex="0" class="${classes.join(' ')}"` +
                    ` data-id="${esc(r.id)}"` +
                    ` aria-current="${isSelected ? 'true' : 'false'}">` +
                    this._iconTile(
                        'tc-crafting-panel-row-icon',
                        r.icon || r.output.item.icon,
                        name,
                    ) +
                    `<span class="tc-crafting-panel-row-name">${esc(name)}</span>` +
                    `</div>`
                )
            })
            .join('')

        const detailMarkup = active
            ? this._detailMarkup(active, crafting)
            : `<p class="tc-crafting-panel-detail-empty">Select a recipe.</p>`

        this.innerHTML =
            `<div class="tc-crafting-panel-list" role="list">${rowsMarkup}</div>` +
            `<div class="tc-crafting-panel-detail">${detailMarkup}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CraftingPanel
    }
}
