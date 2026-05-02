import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/PerkPicker.styles.js'

export interface Perk {
    id: string
    name: string
    description?: string
    icon?: string
    selected?: boolean
    locked?: boolean
}

@customElement('gc-perk-picker')
export class PerkPicker extends GameElement {
    static styles = styles

    @property({ type: Array }) perks: Perk[] = []
    @property({ type: Number }) columns = 3

    render() {
        return html`<style>:host { --gc-cols: ${this.columns}; }</style>
            ${this.perks.map((p) => html`<button class=${p.selected ? 'selected' : ''} ?disabled=${p.locked}
                @click=${() => this.emit('select', { id: p.id })}>
                <div class="head"><span class="icon">${p.icon ?? ''}</span><strong>${p.name}</strong></div>
                ${p.description ? html`<div class="desc">${p.description}</div>` : nothing}
            </button>`)}`
    }
}
