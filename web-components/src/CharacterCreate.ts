import { esc } from './internal/esc'
const TAG_NAME = 'tc-character-create'

export interface CharacterCreateField {
    id: string
    label: string
    type?: 'text' | 'select' | 'number' | 'range'
    options?: { value: string; label: string }[]
    min?: number
    max?: number
}

export class CharacterCreate extends HTMLElement {
    private _initialised = false
    private _fields: CharacterCreateField[] = []
    private _values: Record<string, string | number> = {}
    // Set while reflecting the name attribute from a keystroke so the
    // attributeChangedCallback re-render is suppressed (preserves the caret).
    private _suppressRender = false

    onName: ((value: string) => void) | null = null
    onChange: ((id: string, value: string | number) => void) | null = null
    onConfirm: ((name: string, values: Record<string, string | number>) => void) | null = null

    static get observedAttributes(): string[] {
        return ['name', 'heading', 'confirm-label', 'name-placeholder']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'form')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised || this._suppressRender) return
        this.render()
    }

    get name(): string {
        return this.getAttribute('name') ?? ''
    }
    set name(v: string) {
        if (v) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get heading(): string {
        return this.getAttribute('heading') ?? 'New Character'
    }
    set heading(v: string | null) {
        if (v != null) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get confirmLabel(): string {
        return this.getAttribute('confirm-label') ?? 'Confirm'
    }
    set confirmLabel(v: string | null) {
        if (v != null) this.setAttribute('confirm-label', v)
        else this.removeAttribute('confirm-label')
    }

    get namePlaceholder(): string {
        return this.getAttribute('name-placeholder') ?? 'Character name'
    }
    set namePlaceholder(v: string | null) {
        if (v != null) this.setAttribute('name-placeholder', v)
        else this.removeAttribute('name-placeholder')
    }

    get fields(): CharacterCreateField[] {
        return this._fields.slice()
    }
    set fields(v: CharacterCreateField[]) {
        this._fields = Array.isArray(v) ? v.slice() : []
        if (this._initialised) this.render()
    }

    get values(): Record<string, string | number> {
        return { ...this._values }
    }
    set values(v: Record<string, string | number>) {
        this._values = v && typeof v === 'object' ? { ...v } : {}
        if (this._initialised) this.render()
    }

    private emit<T>(name: string, detail: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private fieldMarkup(field: CharacterCreateField): string {
        const value = this._values[field.id]
        const valueStr = value == null ? '' : String(value)
        const type = field.type || 'text'
        const idAttr = esc(field.id)
        const labelHtml = `<label class="form-label tc-character-create-field-label">${esc(field.label)}</label>`

        if (type === 'select') {
            const options = (field.options || [])
                .map((opt) => {
                    const selected = opt.value === valueStr ? ' selected' : ''
                    return `<option value="${esc(opt.value)}"${selected}>${esc(opt.label)}</option>`
                })
                .join('')
            return `<div class="tc-character-create-field" data-id="${idAttr}">
                ${labelHtml}
                <select class="form-select tc-character-create-control" data-control="select">${options}</select>
            </div>`
        }

        if (type === 'range') {
            const min = field.min ?? 0
            const max = field.max ?? 100
            const numericValue = Number(value)
            const v = Number.isFinite(numericValue) ? numericValue : min
            return `<div class="tc-character-create-field" data-id="${idAttr}">
                <div class="tc-character-create-range-row">
                    ${labelHtml}
                    <span class="tc-character-create-range-value">${v}</span>
                </div>
                <input class="form-range tc-character-create-range" type="range" data-control="range" min="${min}" max="${max}" value="${v}" />
            </div>`
        }

        if (type === 'number') {
            const minAttr = field.min != null ? ` min="${field.min}"` : ''
            const maxAttr = field.max != null ? ` max="${field.max}"` : ''
            return `<div class="tc-character-create-field" data-id="${idAttr}">
                ${labelHtml}
                <input class="form-control tc-character-create-control" type="number" data-control="number" value="${esc(valueStr)}"${minAttr}${maxAttr} />
            </div>`
        }

        return `<div class="tc-character-create-field" data-id="${idAttr}">
            ${labelHtml}
            <input class="form-control tc-character-create-control" type="text" data-control="text" value="${esc(valueStr)}" />
        </div>`
    }

    private render(): void {
        // Snapshot focus + caret so a re-render (e.g. from a values/fields
        // update) does not yank the user out of the control they were editing.
        const focus = this._snapshotFocus()

        const fieldsMarkup = this._fields.map((f) => this.fieldMarkup(f)).join('')

        this.innerHTML = `
            <div class="tc-character-create-header">
                <span class="tc-character-create-eyebrow">${esc(this.heading)}</span>
                <input class="form-control tc-character-create-name" type="text" data-control="name" value="${esc(this.name)}" placeholder="${esc(this.namePlaceholder)}" />
            </div>
            <div class="tc-character-create-fields">${fieldsMarkup}</div>
            <div class="tc-character-create-footer">
                <button type="button" class="btn btn-primary tc-character-create-confirm">${esc(this.confirmLabel)}</button>
            </div>
        `

        const nameInput = this.querySelector<HTMLInputElement>('.tc-character-create-name')
        nameInput?.addEventListener('input', () => {
            const v = nameInput.value
            this._suppressRender = true
            if (v) this.setAttribute('name', v)
            else this.removeAttribute('name')
            this._suppressRender = false
            this.emit('tc-name', { value: v })
            if (typeof this.onName === 'function') this.onName(v)
        })

        this.querySelectorAll<HTMLElement>('.tc-character-create-field').forEach((wrapper) => {
            const id = wrapper.dataset.id || ''
            if (!id) return
            const control = wrapper.querySelector('[data-control]') as
                | HTMLInputElement
                | HTMLSelectElement
                | null
            if (!control) return
            const valueDisplay = wrapper.querySelector(
                '.tc-character-create-range-value',
            ) as HTMLElement | null
            const handle = (): void => {
                const kind = control.dataset.control
                let value: string | number = control.value
                if (kind === 'number' || kind === 'range') {
                    const parsed = parseFloat(control.value)
                    value = Number.isFinite(parsed) ? parsed : 0
                    if (valueDisplay) valueDisplay.textContent = String(value)
                }
                this._values = { ...this._values, [id]: value }
                this.emit('tc-change', { id, value })
                if (typeof this.onChange === 'function') this.onChange(id, value)
            }
            control.addEventListener('input', handle)
            control.addEventListener('change', handle)
        })

        const confirm = this.querySelector('.tc-character-create-confirm') as HTMLElement | null
        confirm?.addEventListener('click', () => {
            this.emit('tc-confirm', { name: this.name, values: { ...this._values } })
            if (typeof this.onConfirm === 'function') this.onConfirm(this.name, { ...this._values })
        })

        this._restoreFocus(focus)
    }

    private _snapshotFocus(): { key: string; start: number | null; end: number | null } | null {
        const active = document.activeElement
        if (!(active instanceof HTMLElement) || !this.contains(active)) return null
        const control = active.closest<HTMLElement>('[data-control]')
        if (!control) return null
        const kind = control.dataset.control
        const key =
            kind === 'name'
                ? 'name'
                : `field:${control.closest('.tc-character-create-field')?.getAttribute('data-id') ?? ''}`
        let start: number | null = null
        let end: number | null = null
        if (
            active instanceof HTMLInputElement &&
            (active.type === 'text' || active.type === 'number')
        ) {
            start = active.selectionStart
            end = active.selectionEnd
        }
        return { key, start, end }
    }

    private _restoreFocus(
        focus: { key: string; start: number | null; end: number | null } | null,
    ): void {
        if (!focus) return
        const selector =
            focus.key === 'name'
                ? '.tc-character-create-name'
                : `.tc-character-create-field[data-id="${CSS.escape(focus.key.slice('field:'.length))}"] [data-control]`
        const el = this.querySelector<HTMLElement>(selector)
        if (!el) return
        el.focus()
        if (
            el instanceof HTMLInputElement &&
            focus.start != null &&
            (el.type === 'text' || el.type === 'number')
        ) {
            try {
                el.setSelectionRange(focus.start, focus.end ?? focus.start)
            } catch {
                // number inputs in some browsers reject setSelectionRange — ignore.
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CharacterCreate
    }
}
