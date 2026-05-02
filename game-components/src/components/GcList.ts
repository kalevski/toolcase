import { html, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/GcList.scss'

export interface GcListItem {
    id: string
    label?: string
    icon?: string
    meta?: string
    disabled?: boolean
}

@customElement('gc-list')
export class GcList extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) items: GcListItem[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''

    render() {
        return html`<ul>${this.items.map((item) => html`
            <li>
                <button ?disabled=${item.disabled} class=${item.id === this.selectedId ? 'selected' : ''} @click=${() => this.emit('select', { id: item.id })}>
                    ${item.icon ? html`<span class="icon">${item.icon}</span>` : null}
                    <span class="label">${item.label ?? item.id}</span>
                    ${item.meta ? html`<span class="meta">${item.meta}</span>` : null}
                </button>
            </li>
        `)}</ul>`
    }
}
