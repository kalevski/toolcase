import { html, nothing } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/ComboBox.styles.js'

export interface ComboOption { value: string; label: string; keywords?: string[] }

@customElement('gc-combo-box')
export class ComboBox extends GameElement {
    static styles = styles

    @property({ type: Array }) options: ComboOption[] = []
    @property() value = ''
    @property() placeholder = 'Select...'
    @property({ type: Boolean }) disabled = false

    @state() private _query = ''
    @state() private _open = false

    @query('input') private _input!: HTMLInputElement

    private _onDoc = (event: MouseEvent) => {
        if (!this.contains(event.target as Node)) { this._open = false }
    }

    connectedCallback(): void { super.connectedCallback(); document.addEventListener('mousedown', this._onDoc) }
    disconnectedCallback(): void { document.removeEventListener('mousedown', this._onDoc); super.disconnectedCallback() }

    private _select(option: ComboOption): void {
        this.value = option.value
        this._open = false
        this._query = ''
        this.emit('change', { value: option.value })
    }

    render() {
        const selected = this.options.find((option) => option.value === this.value)
        const filtered = this.options.filter((option) => {
            if (!this._query) return true
            const q = this._query.toLowerCase()
            return option.label.toLowerCase().includes(q) || (option.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q))
        })
        return html`
            <input type="text"
                .value=${this._open ? this._query : (selected?.label ?? '')}
                placeholder=${this.placeholder}
                ?disabled=${this.disabled}
                @focus=${() => { this._open = true }}
                @input=${() => { this._query = this._input.value; this._open = true }} />
            ${this._open && filtered.length ? html`<ul>${filtered.map((option) => html`
                <li @mousedown=${() => this._select(option)}>${option.label}</li>
            `)}</ul>` : nothing}
        `
    }
}
