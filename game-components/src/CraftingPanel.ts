import type { InventoryItem } from './ItemSlot'

const TAG_NAME = 'gc-crafting-panel'

export interface CraftingIngredient {
    item: InventoryItem
    qty: number
    available?: number
}

export interface CraftingRecipe {
    id: string
    name: string
    icon?: string
    inputs: CraftingIngredient[]
    output: { item: InventoryItem, qty?: number }
}

export interface CraftingPanelEventMap {
    select: CustomEvent<{ id: string }>
    craft: CustomEvent<{ id: string }>
}

export class CraftingPanel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['selected-id', 'crafting']
    }

    private _recipes: CraftingRecipe[] = []

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

    private isAffordable(recipe: CraftingRecipe): boolean {
        return recipe.inputs.every((ing) => {
            if (typeof ing.available !== 'number') return true
            return ing.available >= ing.qty
        })
    }

    private renderIngredient(ing: CraftingIngredient): string {
        const icon = ing.item.icon || '◆'
        const name = ing.item.name ?? ing.item.id
        const have = typeof ing.available === 'number' ? ing.available : null
        const insufficient = have != null && have < ing.qty
        const cls = `gc-crafting-panel-ingredient${insufficient ? ' is-insufficient' : ''}`
        const haveText = have != null ? `${have}/${ing.qty}` : `${ing.qty}`
        return `<div class="${cls}">
            <span class="gc-crafting-panel-ingredient-icon">${this.escape(icon)}</span>
            <span class="gc-crafting-panel-ingredient-name">${this.escape(name)}</span>
            <span class="gc-crafting-panel-ingredient-qty">${haveText}</span>
        </div>`
    }

    private render(): void {
        const selected = this.selectedId
        const crafting = this.crafting
        const active = this._recipes.find((r) => r.id === selected) ?? null

        const rowsMarkup = this._recipes.map((r) => {
            const isSelected = r.id === selected
            const affordable = this.isAffordable(r)
            const cls = `gc-crafting-panel-row${isSelected ? ' is-selected' : ''}${affordable ? '' : ' is-unaffordable'}`
            const icon = r.icon || r.output.item.icon || '◆'
            return `<div role="listitem" tabindex="0" class="${cls}" data-id="${this.escape(r.id)}">
                <span class="gc-crafting-panel-row-icon">${this.escape(icon)}</span>
                <span class="gc-crafting-panel-row-name">${this.escape(r.name)}</span>
            </div>`
        }).join('')

        const detailMarkup = active
            ? this.renderDetail(active, crafting)
            : `<div class="gc-crafting-panel-detail-empty">Select a recipe.</div>`

        this.innerHTML = `
            <div class="gc-crafting-panel-list" role="list">${rowsMarkup}</div>
            <div class="gc-crafting-panel-detail">${detailMarkup}</div>
        `

        this.querySelectorAll<HTMLElement>('.gc-crafting-panel-row').forEach((el) => {
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

        const craftBtn = this.querySelector('.gc-crafting-panel-craft') as HTMLButtonElement | null
        if (craftBtn && active && this.isAffordable(active) && !crafting) {
            craftBtn.addEventListener('click', () => {
                this.emit('craft', { id: active.id })
            })
        }
    }

    private renderDetail(recipe: CraftingRecipe, crafting: boolean): string {
        const affordable = this.isAffordable(recipe)
        const ingredients = recipe.inputs.map((ing) => this.renderIngredient(ing)).join('')
        const outputIcon = recipe.output.item.icon || '◆'
        const outputName = recipe.output.item.name ?? recipe.output.item.id
        const outputQty = recipe.output.qty ?? 1
        const disabled = !affordable || crafting
        const btnLabel = crafting ? 'Crafting…' : 'Craft'
        return `
            <gc-eyebrow class="gc-crafting-panel-detail-eyebrow">Output</gc-eyebrow>
            <div class="gc-crafting-panel-output">
                <span class="gc-crafting-panel-output-icon">${this.escape(outputIcon)}</span>
                <span class="gc-crafting-panel-output-name">${this.escape(outputName)}</span>
                <span class="gc-crafting-panel-output-qty">×${outputQty}</span>
            </div>
            <gc-eyebrow class="gc-crafting-panel-detail-eyebrow">Inputs</gc-eyebrow>
            <div class="gc-crafting-panel-ingredients">${ingredients}</div>
            <button type="button" class="gc-crafting-panel-craft" ${disabled ? 'disabled' : ''}>${btnLabel}</button>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CraftingPanel
    }
}
