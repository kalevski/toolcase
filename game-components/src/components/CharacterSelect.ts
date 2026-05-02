import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/CharacterSelect.styles.js'

export interface CharacterEntry {
    id: string
    name: string
    role?: string
    locked?: boolean
    portrait?: string
    description?: string
    stats?: Array<{ label: string; value: number; max?: number }>
}

@customElement('gc-character-select')
export class CharacterSelect extends GameElement {
    static styles = styles

    @property({ type: Array }) characters: CharacterEntry[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''

    render() {
        const activeId = this.selectedId || this.characters[0]?.id
        const active = this.characters.find((character) => character.id === activeId)
        return html`
            <div class="grid">${this.characters.map((c) => html`<button
                class=${c.id === activeId ? 'selected' : ''}
                ?disabled=${c.locked}
                @click=${() => this.emit('select', { id: c.id })}
                @dblclick=${() => this.emit('confirm', { id: c.id })}>
                ${c.portrait ?? '👤'}
                ${c.locked ? html`<span class="lock">🔒</span>` : nothing}
            </button>`)}</div>
            ${active ? html`<aside>
                <h2>${active.name}</h2>
                ${active.role ? html`<div class="role">${active.role}</div>` : nothing}
                ${active.description ? html`<div class="desc">${active.description}</div>` : nothing}
                ${active.stats ? html`<div class="stats">${active.stats.map((stat) => html`<div>
                    <div class="stat-row"><span>${stat.label}</span><span>${stat.value}${stat.max ? ` / ${stat.max}` : ''}</span></div>
                    <div class="bar"><div class="fill" style="width: ${(stat.value / (stat.max ?? 100)) * 100}%"></div></div>
                </div>`)}</div>` : nothing}
                <button class="confirm" @click=${() => this.emit('confirm', { id: active.id })}>Select</button>
            </aside>` : nothing}`
    }
}
