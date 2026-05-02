import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement, rarityVar } from '../base.js'
import { styles } from '../styles/LootList.styles.js'
import type { InventoryItem } from './ItemSlot.js'

@customElement('gc-loot-list')
export class LootList extends GameElement {
    static styles = styles

    @property({ type: Array }) items: Array<{ item: InventoryItem; qty?: number }> = []
    @property({ attribute: 'list-title' }) listTitle = 'Loot'

    render() {
        return html`
            <div class="head">
                <strong>${this.listTitle}</strong>
                <button class="all" @click=${() => this.emit('take-all')}>Take all</button>
            </div>
            <ul>${this.items.map((entry) => html`<li @click=${() => this.emit('take', { id: entry.item.id })}>
                <span class="icon" style=${`color: ${rarityVar(entry.item.rarity)}`}>${entry.item.icon ?? ''}</span>
                <span class="name" style=${`color: ${rarityVar(entry.item.rarity)}`}>${entry.item.name ?? entry.item.id}</span>
                ${entry.qty && entry.qty > 1 ? html`<span style="opacity:0.7">×${entry.qty}</span>` : nothing}
            </li>`)}</ul>`
    }
}
