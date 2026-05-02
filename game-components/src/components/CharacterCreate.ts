import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CharacterCreate.scss'

export interface CharacterCreateField {
    id: string
    label: string
    type?: 'cycle' | 'slider' | 'text'
    options?: Array<{ id: string; label: string }>
    min?: number
    max?: number
}

@customElement('gc-character-create')
export class CharacterCreate extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) fields: CharacterCreateField[] = []
    @property({ type: Object }) values: Record<string, string | number> = {}
    @property() name = ''

    render() {
        return html`
            <div class="preview"><slot name="preview"></slot></div>
            <div class="fields">
                <input type="text" placeholder="Character name" .value=${this.name}
                    @input=${(event: Event) => this.emit('name', { value: (event.target as HTMLInputElement).value })} />
                ${this.fields.map((field) => html`<div class="field">
                    <label>${field.label}</label>
                    ${field.type === 'slider' ? html`<input type="range" min=${field.min ?? 0} max=${field.max ?? 100}
                        .value=${String(this.values[field.id] ?? field.min ?? 0)}
                        @input=${(event: Event) => this.emit('change', { id: field.id, value: Number((event.target as HTMLInputElement).value) })} />` : nothing}
                    ${field.type === 'text' ? html`<input type="text" .value=${String(this.values[field.id] ?? '')}
                        @input=${(event: Event) => this.emit('change', { id: field.id, value: (event.target as HTMLInputElement).value })} />` : nothing}
                    ${(!field.type || field.type === 'cycle') && field.options ? html`<div class="options">${field.options.map((option) => html`
                        <button class=${this.values[field.id] === option.id ? 'selected' : ''}
                            @click=${() => this.emit('change', { id: field.id, value: option.id })}>${option.label}</button>
                    `)}</div>` : nothing}
                </div>`)}
                <button class="create" @click=${() => this.emit('confirm', { name: this.name, values: this.values })}>Create</button>
            </div>`
    }
}
