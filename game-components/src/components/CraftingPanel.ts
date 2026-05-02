import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CraftingPanel.styles.js'
import './ItemSlot.js'
import type { InventoryItem } from './ItemSlot.js'

export interface CraftingRecipe {
    id: string
    name: string
    icon?: string
    inputs: Array<{ item: InventoryItem; qty: number; available?: number }>
    output: { item: InventoryItem; qty: number }
}

@customElement('gc-crafting-panel')
export class CraftingPanel extends GameElement {
    static styles = styles

    @property({ type: Array }) recipes: CraftingRecipe[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''
    @property({ type: Boolean }) crafting = false

    render() {
        const activeId = this.selectedId || this.recipes[0]?.id
        const active = this.recipes.find((recipe) => recipe.id === activeId)
        return html`
            <ul>${this.recipes.map((r) => html`<li><button class=${r.id === activeId ? 'active' : ''}
                @click=${() => this.emit('select', { id: r.id })}>
                <span style="font-size:20px">${r.icon ?? ''}</span><span>${r.name}</span>
            </button></li>`)}</ul>
            ${active ? html`<div class="detail">
                <h3>${active.name}</h3>
                <div class="recipe">
                    <div>
                        <div class="label">Requires</div>
                        <div class="inputs">${active.inputs.map((input) => {
                            const enough = input.available === undefined || input.available >= input.qty
                            return html`<div class="input">
                                <gc-item-slot .item=${input.item} size="40"></gc-item-slot>
                                <span class=${enough ? 'enough' : 'missing'}>${input.available ?? '?'}/${input.qty}</span>
                            </div>`
                        })}</div>
                    </div>
                    <div class="arrow">→</div>
                    <div>
                        <div class="label">Output</div>
                        <div style="display:flex;gap:4px;align-items:center">
                            <gc-item-slot .item=${active.output.item} size="40"></gc-item-slot>
                            <span style="font-size:16px">×${active.output.qty}</span>
                        </div>
                    </div>
                </div>
                <button class="craft" ?disabled=${this.crafting} @click=${() => this.emit('craft', { id: active.id })}>${this.crafting ? 'Crafting...' : 'Craft'}</button>
            </div>` : nothing}`
    }
}
