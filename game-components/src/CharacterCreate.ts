const TAG_NAME = 'gc-character-create'

export interface CharacterCreateField {
    id: string
    label: string
    type?: 'text' | 'select' | 'number' | 'range'
    options?: { value: string, label: string }[]
    min?: number
    max?: number
}

export interface CharacterCreateEventMap {
    name: CustomEvent<{ value: string }>
    change: CustomEvent<{ id: string, value: string | number }>
    confirm: CustomEvent<{ name: string, values: Record<string, string | number> }>
}

export class CharacterCreate extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['name']
    }

    private _fields: CharacterCreateField[] = []
    private _values: Record<string, string | number> = {}

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'form')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get fields(): CharacterCreateField[] {
        return this._fields.slice()
    }
    set fields(v: CharacterCreateField[]) {
        this._fields = Array.isArray(v) ? v.slice() : []
        if (this.isConnected) this.render()
    }

    get values(): Record<string, string | number> {
        return { ...this._values }
    }
    set values(v: Record<string, string | number>) {
        this._values = v && typeof v === 'object' ? { ...v } : {}
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

    private fieldMarkup(field: CharacterCreateField): string {
        const value = this._values[field.id]
        const valueStr = value == null ? '' : String(value)
        const type = field.type || 'text'

        if (type === 'select') {
            const options = (field.options || []).map((opt) => {
                const selected = opt.value === valueStr ? ' selected' : ''
                return `<option value="${this.escape(opt.value)}"${selected}>${this.escape(opt.label)}</option>`
            }).join('')
            return `<div class="gc-character-create-field" data-id="${this.escape(field.id)}">
                <label class="gc-character-create-field-label">${this.escape(field.label)}</label>
                <select class="gc-character-create-control" data-control="select">${options}</select>
            </div>`
        }

        if (type === 'range') {
            const min = field.min ?? 0
            const max = field.max ?? 100
            const numericValue = Number(value)
            const v = Number.isFinite(numericValue) ? numericValue : min
            return `<div class="gc-character-create-field" data-id="${this.escape(field.id)}">
                <div class="gc-character-create-range-row">
                    <label class="gc-character-create-field-label">${this.escape(field.label)}</label>
                    <span class="gc-character-create-range-value">${v}</span>
                </div>
                <input class="gc-character-create-range" type="range" data-control="range" min="${min}" max="${max}" value="${v}" />
            </div>`
        }

        if (type === 'number') {
            const min = field.min
            const max = field.max
            const minAttr = min != null ? ` min="${min}"` : ''
            const maxAttr = max != null ? ` max="${max}"` : ''
            return `<div class="gc-character-create-field" data-id="${this.escape(field.id)}">
                <label class="gc-character-create-field-label">${this.escape(field.label)}</label>
                <input class="gc-character-create-control" type="number" data-control="number" value="${this.escape(valueStr)}"${minAttr}${maxAttr} />
            </div>`
        }

        return `<div class="gc-character-create-field" data-id="${this.escape(field.id)}">
            <label class="gc-character-create-field-label">${this.escape(field.label)}</label>
            <input class="gc-character-create-control" type="text" data-control="text" value="${this.escape(valueStr)}" />
        </div>`
    }

    private render(): void {
        const fieldsMarkup = this._fields.map((f) => this.fieldMarkup(f)).join('')

        this.innerHTML = `
            <div class="gc-character-create-root">
                <header class="gc-character-create-header">
                    <gc-eyebrow class="gc-character-create-eyebrow">New Character</gc-eyebrow>
                    <input class="gc-character-create-name" type="text" data-control="name" value="${this.escape(this.name)}" placeholder="Character name" />
                </header>
                <div class="gc-character-create-fields">${fieldsMarkup}</div>
                <footer class="gc-character-create-footer">
                    <gc-metal-button class="gc-character-create-confirm" variant="primary">Confirm</gc-metal-button>
                </footer>
            </div>
        `

        const nameInput = this.querySelector<HTMLInputElement>('.gc-character-create-name')
        nameInput?.addEventListener('input', () => {
            const v = nameInput.value
            if (v) this.setAttribute('name', v)
            else this.removeAttribute('name')
            this.emit('name', { value: v })
        })

        this.querySelectorAll<HTMLElement>('.gc-character-create-field').forEach((wrapper) => {
            const id = wrapper.dataset.id || ''
            if (!id) return
            const control = wrapper.querySelector('[data-control]') as HTMLInputElement | HTMLSelectElement | null
            if (!control) return
            const valueDisplay = wrapper.querySelector('.gc-character-create-range-value') as HTMLElement | null
            const handle = () => {
                const kind = control.dataset.control
                let value: string | number = control.value
                if (kind === 'number' || kind === 'range') {
                    const parsed = parseFloat(control.value)
                    value = Number.isFinite(parsed) ? parsed : 0
                    if (valueDisplay) valueDisplay.textContent = String(value)
                }
                this._values = { ...this._values, [id]: value }
                this.emit('change', { id, value })
            }
            control.addEventListener('input', handle)
            control.addEventListener('change', handle)
        })

        const confirm = this.querySelector('.gc-character-create-confirm') as HTMLElement | null
        confirm?.addEventListener('click', () => {
            this.emit('confirm', { name: this.name, values: { ...this._values } })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CharacterCreate
    }
}
