import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/MainMenu.styles.js'

export interface MainMenuItem { id: string; label: string; disabled?: boolean; badge?: string }

@customElement('gc-main-menu')
export class MainMenu extends GameElement {
    static styles = styles

    @property({ type: Array }) items: MainMenuItem[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''
    @property({ attribute: 'menu-title' }) menuTitle = ''
    @property() subtitle = ''

    @state() private _activeId: string | null = null

    private _onKey = (event: KeyboardEvent) => {
        if (this.items.length === 0) return
        if (!['ArrowUp', 'ArrowDown', 'Enter'].includes(event.key)) return
        event.preventDefault()
        const active = this._activeId ?? this.selectedId ?? this.items[0]?.id ?? ''
        const i = this.items.findIndex((item) => item.id === active)
        if (event.key === 'ArrowDown') {
            const next = this.items.slice(i + 1).find((item) => !item.disabled) ?? this.items.find((item) => !item.disabled)
            if (next) this._activeId = next.id
        } else if (event.key === 'ArrowUp') {
            const prev = [...this.items.slice(0, i)].reverse().find((item) => !item.disabled) ?? [...this.items].reverse().find((item) => !item.disabled)
            if (prev) this._activeId = prev.id
        } else if (event.key === 'Enter') {
            const item = this.items.find((item) => item.id === active)
            if (item && !item.disabled) this.emit('select', { id: item.id })
        }
    }

    connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this._onKey) }
    disconnectedCallback(): void { window.removeEventListener('keydown', this._onKey); super.disconnectedCallback() }

    render() {
        const active = this.selectedId || this._activeId || this.items[0]?.id
        return html`
            <slot name="backdrop"></slot>
            <div class="wrap">
                ${this.menuTitle ? html`<h1>${this.menuTitle}</h1>` : nothing}
                ${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : nothing}
                <ul>${this.items.map((item) => html`
                    <li><button
                        class=${item.id === active ? 'selected' : ''}
                        ?disabled=${item.disabled}
                        @mouseenter=${() => { this._activeId = item.id }}
                        @click=${() => this.emit('select', { id: item.id })}>
                        <span class="label">${item.label}</span>
                        ${item.badge ? html`<span class="badge">${item.badge}</span>` : nothing}
                    </button></li>
                `)}</ul>
                <slot name="footer"></slot>
            </div>`
    }
}
