import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/SaveSlotList.scss'

export interface SaveSlot {
    id: string
    name?: string
    timestamp?: string
    location?: string
    level?: string
    playtime?: string
    empty?: boolean
    autosave?: boolean
}

@customElement('gc-save-slot-list')
export class SaveSlotList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) slots: SaveSlot[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''
    @property() mode: 'load' | 'save' = 'load'

    render() {
        return html`${this.slots.map((slot) => {
            const selected = slot.id === this.selectedId
            return html`<div class="slot ${selected ? 'selected' : ''} ${slot.empty ? 'empty' : ''}" @click=${() => this.emit('select', { id: slot.id })}>
                <div class="thumb">${slot.empty ? 'Empty' : '🖼'}</div>
                <div class="info">
                    <div class="name">${slot.name ?? `Slot ${slot.id}`}${slot.autosave ? html`<span class="auto">AUTO</span>` : nothing}</div>
                    ${!slot.empty ? html`<div class="meta">
                        ${slot.location ? html`<span>📍 ${slot.location}</span>` : nothing}
                        ${slot.level ? html`<span>Lv ${slot.level}</span>` : nothing}
                        ${slot.playtime ? html`<span>⏱ ${slot.playtime}</span>` : nothing}
                    </div>` : nothing}
                    ${slot.timestamp ? html`<div class="timestamp">${slot.timestamp}</div>` : nothing}
                </div>
                ${selected ? html`<div class="actions">
                    ${this.mode === 'save' ? html`<button class="primary" @click=${(event: Event) => { event.stopPropagation(); this.emit('save', { id: slot.id }) }}>Save</button>` : nothing}
                    ${this.mode === 'load' && !slot.empty ? html`<button class="primary" @click=${(event: Event) => { event.stopPropagation(); this.emit('load', { id: slot.id }) }}>Load</button>` : nothing}
                    ${!slot.empty && !slot.autosave ? html`<button class="danger" @click=${(event: Event) => { event.stopPropagation(); this.emit('delete', { id: slot.id }) }}>Delete</button>` : nothing}
                </div>` : nothing}
            </div>`
        })}`
    }
}
