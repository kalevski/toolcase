import { icon } from './icons'
import { Plus, ChevronUp, ChevronDown, Trash2 } from 'lucide-static'

const TAG_NAME = 'tc-json-schema-def'

let _idCounter = 0

// Pre-resolved inline icons (always rendered — resolve once at module load).
const plusIconHtml = icon(Plus)
const chevronUpIconHtml = icon(ChevronUp)
const chevronDownIconHtml = icon(ChevronDown)
const removeIconHtml = icon(Trash2)

export type SchemaPropertyType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'ref'

const PROPERTY_TYPES: SchemaPropertyType[] = ['string', 'number', 'integer', 'boolean', 'object', 'array', 'ref']

export interface SchemaProperty {
    key: string
    type: SchemaPropertyType
    required?: boolean
    /** Selected reference value for `ref` / `array` / `object` types. */
    ref?: string
}

export interface SchemaRefItem {
    value: string
    label?: string
}

function esc(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// `ref` types carry a $ref selector; array/object carry an item/object ref.
function needsRef(type: SchemaPropertyType): boolean {
    return type === 'array' || type === 'object' || type === 'ref'
}

function isValidType(t: unknown): t is SchemaPropertyType {
    return typeof t === 'string' && (PROPERTY_TYPES as string[]).includes(t)
}

function parseValue(raw: string): SchemaProperty[] {
    const trimmed = (raw ?? '').trim()
    if (trimmed === '') return []
    let parsed: unknown
    try {
        parsed = JSON.parse(trimmed)
    } catch {
        return []
    }
    if (!Array.isArray(parsed)) return []
    return parsed.map((p): SchemaProperty => {
        const item = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>
        const type = isValidType(item.type) ? item.type : 'string'
        const prop: SchemaProperty = {
            key: typeof item.key === 'string' ? item.key : '',
            type,
        }
        if (item.required === true) prop.required = true
        if (needsRef(type) && typeof item.ref === 'string') prop.ref = item.ref
        return prop
    })
}

interface FocusTarget {
    idx: number
    field: 'key' | 'type' | 'up' | 'down' | 'remove'
    select?: boolean
}

export class JSONSchemaDef extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _props: SchemaProperty[] = []
    private _propsInitialised = false

    private _refList: SchemaRefItem[] = []
    private _arrayRefList: SchemaRefItem[] = []
    private _objectRefList: SchemaRefItem[] = []

    onChange: ((value: string) => void) | null = null
    onLabelChange: ((label: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'value', 'default-value', 'disabled', 'loading']
    }

    constructor() {
        super()
        this._idPrefix = `tc-json-schema-def-${++_idCounter}`
    }

    connectedCallback(): void {
        if (this._initialised) return
        if (!this._propsInitialised) this._seedProps()
        this.addEventListener('input', this._onInput)
        this.addEventListener('change', this._onChange)
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('focusout', this._onFocusout)
        this.render()
        this._initialised = true
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('change', this._onChange)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('focusout', this._onFocusout)
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (!this._initialised) return
        if (oldValue === newValue) return

        if (name === 'value') {
            // External controlled update — reparse and re-render from the attribute.
            this._props = parseValue(newValue ?? '')
            this._propsInitialised = true
            this.render()
            return
        }
        if (name === 'default-value') {
            // Only seeds while still uncontrolled (no value attribute set).
            if (!this.hasAttribute('value')) {
                this._props = parseValue(newValue ?? '')
                this._propsInitialised = true
                this.render()
            }
            return
        }
        if (name === 'label') {
            // Patch the live name input in place when present; otherwise re-render
            // (the field's presence is toggled by the attribute's presence).
            const input = this.querySelector<HTMLInputElement>('.tc-json-schema-def-label')
            if (input) {
                if (input.value !== (newValue ?? '')) input.value = newValue ?? ''
            } else {
                this.render()
            }
            return
        }
        // disabled / loading
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v == null) this.removeAttribute('label')
        else this.setAttribute('label', v)
    }

    get value(): string {
        return this._serialize()
    }
    set value(v: string) {
        this.setAttribute('value', v ?? '')
    }

    get defaultValue(): string {
        return this.getAttribute('default-value') ?? ''
    }
    set defaultValue(v: string) {
        this.setAttribute('default-value', v ?? '')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get refList(): SchemaRefItem[] {
        return this._refList
    }
    set refList(v: SchemaRefItem[]) {
        this._refList = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get arrayRefList(): SchemaRefItem[] {
        return this._arrayRefList
    }
    set arrayRefList(v: SchemaRefItem[]) {
        this._arrayRefList = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get objectRefList(): SchemaRefItem[] {
        return this._objectRefList
    }
    set objectRefList(v: SchemaRefItem[]) {
        this._objectRefList = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    // ── Model helpers ──────────────────────────────────────────────────────────

    private _seedProps(): void {
        const rawValue = this.getAttribute('value')
        const raw = rawValue != null ? rawValue : (this.getAttribute('default-value') ?? '[]')
        this._props = parseValue(raw)
        this._propsInitialised = true
    }

    private _serialize(): string {
        return JSON.stringify(
            this._props.map(p => {
                const o: Record<string, unknown> = { key: p.key, type: p.type }
                if (p.required) o.required = true
                if (needsRef(p.type) && p.ref) o.ref = p.ref
                return o
            }),
        )
    }

    private _refsFor(type: SchemaPropertyType): SchemaRefItem[] {
        if (type === 'array') return this._arrayRefList
        if (type === 'object') return this._objectRefList
        if (type === 'ref') return this._refList
        return []
    }

    private _emit(): void {
        const value = this._serialize()
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value },
        }))
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private _emitLabel(label: string): void {
        this.dispatchEvent(new CustomEvent('tc-label-change', {
            bubbles: true,
            composed: true,
            detail: { label },
        }))
        if (typeof this.onLabelChange === 'function') this.onLabelChange(label)
    }

    // Trimmed keys that occur more than once are duplicates.
    private _duplicateKeys(): Set<string> {
        const seen = new Map<string, number>()
        const dups = new Set<string>()
        for (const p of this._props) {
            const k = p.key.trim()
            if (!k) continue
            seen.set(k, (seen.get(k) ?? 0) + 1)
            if ((seen.get(k) ?? 0) > 1) dups.add(k)
        }
        return dups
    }

    private _keyErrorMessage(key: string, dups: Set<string>): string | null {
        const k = key.trim()
        if (k === '') return 'Property name is required'
        if (dups.has(k)) return 'Duplicate property name'
        return null
    }

    // ── Mutations ────────────────────────────────────────────────────────────

    private _addProperty(): void {
        if (this.disabled) return
        const existing = new Set(this._props.map(p => p.key))
        let n = this._props.length + 1
        while (existing.has(`property${n}`)) n++
        this._props.push({ key: `property${n}`, type: 'string' })
        this.render({ idx: this._props.length - 1, field: 'key', select: true })
        this._emit()
    }

    private _removeProperty(idx: number): void {
        if (this.disabled || idx < 0 || idx >= this._props.length) return
        this._props.splice(idx, 1)
        const nextIdx = Math.min(idx, this._props.length - 1)
        this.render(nextIdx >= 0 ? { idx: nextIdx, field: 'remove' } : undefined)
        this._emit()
    }

    private _moveProperty(idx: number, dir: -1 | 1): void {
        if (this.disabled) return
        const target = idx + dir
        if (target < 0 || target >= this._props.length) return
        const t = this._props[idx]
        this._props[idx] = this._props[target]
        this._props[target] = t
        this.render({ idx: target, field: dir === -1 ? 'up' : 'down' })
        this._emit()
    }

    // ── Event handlers ─────────────────────────────────────────────────────────

    private _rowIndex(el: Element): number {
        const row = el.closest<HTMLElement>('.tc-json-schema-def-row')
        if (!row) return -1
        return parseInt(row.getAttribute('data-idx') ?? '-1', 10)
    }

    private _onInput = (e: Event): void => {
        const t = e.target
        if (!(t instanceof HTMLInputElement)) return
        if (t.getAttribute('data-field') !== 'key') return
        const idx = this._rowIndex(t)
        if (idx < 0) return
        this._props[idx].key = t.value
        // Patch validation in place — never re-render on keystroke (preserves caret).
        this._applyValidation()
        this._emit()
    }

    private _onChange = (e: Event): void => {
        const t = e.target
        if (!(t instanceof Element)) return
        const field = t.getAttribute('data-field')
        const idx = this._rowIndex(t)
        if (idx < 0) return

        if (field === 'type' && t instanceof HTMLSelectElement) {
            const type = isValidType(t.value) ? t.value : 'string'
            const prop = this._props[idx]
            prop.type = type
            if (needsRef(type)) prop.ref = this._refsFor(type)[0]?.value
            else delete prop.ref
            // Structural change (ref selector appears/disappears) — full re-render.
            this.render({ idx, field: 'type' })
            this._emit()
        } else if (field === 'ref' && t instanceof HTMLSelectElement) {
            this._props[idx].ref = t.value || undefined
            this._emit()
        } else if (field === 'required' && t instanceof HTMLInputElement) {
            this._props[idx].required = t.checked
            this._emit()
        }
    }

    private _onClick = (e: Event): void => {
        const target = (e.target as Element)?.closest<HTMLElement>('[data-action]')
        if (!target || !this.contains(target)) return
        const action = target.getAttribute('data-action')
        if (action === 'add') {
            this._addProperty()
            return
        }
        const idx = this._rowIndex(target)
        if (idx < 0) return
        if (action === 'up') this._moveProperty(idx, -1)
        else if (action === 'down') this._moveProperty(idx, 1)
        else if (action === 'remove') this._removeProperty(idx)
    }

    private _onKeydown = (e: Event): void => {
        const ke = e as KeyboardEvent
        const t = ke.target
        if (!(t instanceof HTMLInputElement) || !t.classList.contains('tc-json-schema-def-label')) return
        if (ke.key === 'Enter') {
            ke.preventDefault()
            t.blur()
        } else if (ke.key === 'Escape') {
            ke.preventDefault()
            t.value = this.getAttribute('label') ?? ''
            t.blur()
        }
    }

    private _onFocusout = (e: Event): void => {
        const t = (e as FocusEvent).target
        if (!(t instanceof HTMLInputElement) || !t.classList.contains('tc-json-schema-def-label')) return
        const draft = t.value
        const current = this.getAttribute('label') ?? ''
        if (draft === current) return
        // setAttribute reflects + triggers attributeChangedCallback (patches in place).
        this.setAttribute('label', draft)
        this._emitLabel(draft)
    }

    // Surgically toggle duplicate/blank error state on every key input without a
    // full re-render — keeps the focused input and its caret intact.
    private _applyValidation(): void {
        const dups = this._duplicateKeys()
        const rows = this.querySelectorAll<HTMLElement>('.tc-json-schema-def-row')
        rows.forEach(row => {
            const idx = parseInt(row.getAttribute('data-idx') ?? '-1', 10)
            const prop = this._props[idx]
            if (!prop) return
            const input = row.querySelector<HTMLInputElement>('.tc-json-schema-def-key')
            const errEl = row.querySelector<HTMLElement>('.tc-json-schema-def-key-error')
            if (!input || !errEl) return
            const message = this._keyErrorMessage(prop.key, dups)
            if (message) {
                input.setAttribute('aria-invalid', 'true')
                input.classList.add('is-invalid')
                input.setAttribute('aria-describedby', errEl.id)
                errEl.textContent = message
                errEl.hidden = false
            } else {
                input.removeAttribute('aria-invalid')
                input.classList.remove('is-invalid')
                input.removeAttribute('aria-describedby')
                errEl.textContent = ''
                errEl.hidden = true
            }
        })
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private render(focus?: FocusTarget): void {
        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const rows = Array.from({ length: 4 })
                .map(() => `<div class="tc-json-schema-def-skeleton-row" aria-hidden="true"><span class="tc-json-schema-def-skeleton-key"></span><span class="tc-json-schema-def-skeleton-field"></span><span class="tc-json-schema-def-skeleton-actions"></span></div>`)
                .join('')
            this.innerHTML = `<div class="tc-json-schema-def tc-json-schema-def--loading">${rows}<span class="visually-hidden">Loading…</span></div>`
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const disabled = this.disabled
        const disabledAttr = disabled ? ' disabled' : ''
        const disabledClass = disabled ? ' tc-json-schema-def--disabled' : ''
        const dups = this._duplicateKeys()

        const headerHtml = this.hasAttribute('label')
            ? this._renderHeader(disabledAttr)
            : ''

        const rowsHtml = this._props.length === 0
            ? `<div class="tc-json-schema-def-empty">No properties defined</div>`
            : this._props.map((prop, idx) => this._renderRow(prop, idx, dups, disabledAttr)).join('')

        const addHtml = `<button type="button" class="tc-json-schema-def-add" data-action="add"${disabledAttr}>${plusIconHtml}<span>Add property</span></button>`

        this.innerHTML = `<div class="tc-json-schema-def${disabledClass}">`
            + headerHtml
            + `<div class="tc-json-schema-def-properties" role="list">${rowsHtml}</div>`
            + addHtml
            + `</div>`

        if (focus) this._restoreFocus(focus)
    }

    private _renderHeader(disabledAttr: string): string {
        const id = `${this._idPrefix}-name`
        const labelVal = this.getAttribute('label') ?? ''
        return `<div class="tc-json-schema-def-header">`
            + `<label class="tc-json-schema-def-name-label" for="${id}">Schema name</label>`
            + `<input id="${id}" type="text" class="form-control tc-json-schema-def-label" placeholder="Schema name" value="${esc(labelVal)}"${disabledAttr}>`
            + `</div>`
    }

    private _renderRow(prop: SchemaProperty, idx: number, dups: Set<string>, disabledAttr: string): string {
        const propLabel = prop.key || `property ${idx + 1}`
        const errId = `${this._idPrefix}-err-${idx}`
        const message = this._keyErrorMessage(prop.key, dups)
        const invalid = message != null
        const invalidClass = invalid ? ' is-invalid' : ''
        const ariaInvalid = invalid ? ' aria-invalid="true"' : ''
        const describedby = invalid ? ` aria-describedby="${errId}"` : ''

        const keyInput = `<input type="text" class="form-control tc-json-schema-def-key${invalidClass}" data-field="key" placeholder="key" value="${esc(prop.key)}" aria-label="Name for ${esc(propLabel)}"${ariaInvalid}${describedby}${disabledAttr}>`

        const typeOptions = PROPERTY_TYPES.map(t =>
            `<option value="${t}"${t === prop.type ? ' selected' : ''}>${t}</option>`,
        ).join('')
        const typeSelect = `<select class="form-select tc-json-schema-def-type" data-field="type" aria-label="Type for ${esc(propLabel)}"${disabledAttr}>${typeOptions}</select>`

        let refSelect = ''
        if (needsRef(prop.type)) {
            const refs = this._refsFor(prop.type)
            const refLabel = prop.type === 'array'
                ? `Item type for ${propLabel}`
                : prop.type === 'object'
                    ? `Object reference for ${propLabel}`
                    : `Reference for ${propLabel}`
            const options = refs.length === 0
                ? `<option value="">— no references —</option>`
                : refs.map(r => {
                    const ov = r.value
                    const ol = r.label ?? r.value
                    return `<option value="${esc(ov)}"${ov === prop.ref ? ' selected' : ''}>${esc(ol)}</option>`
                }).join('')
            refSelect = `<select class="form-select tc-json-schema-def-ref" data-field="ref" aria-label="${esc(refLabel)}"${disabledAttr}>${options}</select>`
        }

        const requiredId = `${this._idPrefix}-req-${idx}`
        const requiredToggle = `<label class="tc-json-schema-def-required" for="${requiredId}">`
            + `<input id="${requiredId}" type="checkbox" class="form-check-input" data-field="required"${prop.required ? ' checked' : ''} aria-label="Required: ${esc(propLabel)}"${disabledAttr}>`
            + `<span>required</span>`
            + `</label>`

        const actions = `<div class="tc-json-schema-def-row-actions">`
            + `<button type="button" class="tc-json-schema-def-icon-btn" data-action="up" aria-label="Move ${esc(propLabel)} up"${idx === 0 ? ' disabled' : disabledAttr}>${chevronUpIconHtml}</button>`
            + `<button type="button" class="tc-json-schema-def-icon-btn" data-action="down" aria-label="Move ${esc(propLabel)} down"${idx === this._props.length - 1 ? ' disabled' : disabledAttr}>${chevronDownIconHtml}</button>`
            + `<button type="button" class="tc-json-schema-def-icon-btn tc-json-schema-def-remove" data-action="remove" aria-label="Remove ${esc(propLabel)}"${disabledAttr}>${removeIconHtml}</button>`
            + `</div>`

        const errEl = `<div class="tc-json-schema-def-key-error" id="${errId}" role="alert"${invalid ? '' : ' hidden'}>${invalid ? esc(message as string) : ''}</div>`

        return `<div class="tc-json-schema-def-row" role="listitem" data-idx="${idx}">`
            + `<div class="tc-json-schema-def-row-main">`
            + keyInput
            + typeSelect
            + refSelect
            + requiredToggle
            + actions
            + `</div>`
            + errEl
            + `</div>`
    }

    private _restoreFocus(focus: FocusTarget): void {
        const row = this.querySelector<HTMLElement>(`.tc-json-schema-def-row[data-idx="${focus.idx}"]`)
        if (!row) return
        let el: HTMLElement | null = null
        if (focus.field === 'key') el = row.querySelector('.tc-json-schema-def-key')
        else if (focus.field === 'type') el = row.querySelector('.tc-json-schema-def-type')
        else el = row.querySelector(`[data-action="${focus.field}"]`)
        if (el && !(el as HTMLButtonElement).disabled) {
            el.focus()
            if (focus.select && el instanceof HTMLInputElement) el.select()
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: JSONSchemaDef
    }
}
