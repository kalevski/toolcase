import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { icon } from './icons'
import { ChevronDown, Plus, X } from 'lucide-static'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-json-editor'

let _idCounter = 0

// Pre-resolved inline icons (always rendered — resolve once at module load).
const chevronIconHtml = icon(ChevronDown, 'tc-json-editor-chevron-svg')
const plusIconHtml = icon(Plus)
const removeIconHtml = icon(X)

export type JSONEditorFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object'
export type JSONEditorItemType = 'string' | 'number' | 'integer' | 'boolean'

export interface JSONEditorSchemaProperty {
    key: string
    type: JSONEditorFieldType
    label?: string
    defaultValue?: unknown
    enum?: (string | number)[]
    itemType?: JSONEditorItemType
    properties?: JSONEditorSchemaProperty[]
}

type Path = (string | number)[]

interface ParseResult {
    ok: boolean
    schema: JSONEditorSchemaProperty[]
    error: string | null
}

function parseSchema(raw: string): ParseResult {
    const trimmed = (raw ?? '').trim()
    if (trimmed === '') return { ok: true, schema: [], error: null }
    let parsed: unknown
    try {
        parsed = JSON.parse(trimmed)
    } catch (e) {
        return { ok: false, schema: [], error: `Invalid JSON schema: ${(e as Error).message}` }
    }
    if (!Array.isArray(parsed)) {
        return {
            ok: false,
            schema: [],
            error: 'Schema must be a JSON array of property definitions.',
        }
    }
    return { ok: true, schema: parsed as JSONEditorSchemaProperty[], error: null }
}

function typeDefault(type: string | undefined): unknown {
    switch (type) {
        case 'number':
        case 'integer':
            return 0
        case 'boolean':
            return false
        default:
            return ''
    }
}

function buildDefault(schema: JSONEditorSchemaProperty[]): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    for (const prop of schema) {
        if (!prop || typeof prop.key !== 'string') continue
        if (prop.type === 'array') {
            obj[prop.key] = []
        } else if (prop.type === 'object') {
            obj[prop.key] = prop.properties ? buildDefault(prop.properties) : {}
        } else if (prop.defaultValue !== undefined) {
            obj[prop.key] = prop.defaultValue
        } else if (Array.isArray(prop.enum) && prop.enum.length > 0) {
            obj[prop.key] = prop.enum[0]
        } else {
            obj[prop.key] = typeDefault(prop.type)
        }
    }
    return obj
}

function clone<T>(v: T): T {
    return v == null ? v : structuredClone(v)
}

function getValueAtPath(obj: unknown, path: Path): unknown {
    let current = obj
    for (const seg of path) {
        if (current == null || typeof current !== 'object') return undefined
        current = (current as Record<string | number, unknown>)[seg]
    }
    return current
}

// In-place set — every path we render already exists in `_data`, but we create
// intermediate containers defensively so a malformed value object can't throw.
function setValueAtPath(root: Record<string, unknown>, path: Path, val: unknown): void {
    if (path.length === 0) return
    let current: Record<string | number, unknown> = root
    for (let i = 0; i < path.length - 1; i++) {
        const seg = path[i]
        let next = current[seg]
        if (next == null || typeof next !== 'object') {
            next = typeof path[i + 1] === 'number' ? [] : {}
            current[seg] = next
        }
        current = next as Record<string | number, unknown>
    }
    current[path[path.length - 1]] = val
}

// Walk the parsed schema following a value path; numeric segments descend into
// an array property's item-shape (`properties`). Returns the property node whose
// container the path points at (used by add/remove to know the item shape).
function schemaPropAtPath(
    schema: JSONEditorSchemaProperty[],
    path: Path,
): JSONEditorSchemaProperty | null {
    let props: JSONEditorSchemaProperty[] = schema
    let prop: JSONEditorSchemaProperty | null = null
    for (const seg of path) {
        if (typeof seg === 'number') {
            props = prop?.properties ?? []
            continue
        }
        prop = props.find((p) => p && p.key === seg) ?? null
        if (!prop) return null
        props = prop.properties ?? []
    }
    return prop
}

export class JSONEditor extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _data: Record<string, unknown> = {}
    private _defaultValue: Record<string, unknown> | undefined
    private _valueSet = false
    private _dataInitialised = false
    private _collapsed = new Set<string>()

    onChange: ((value: Record<string, unknown>) => void) | null = null

    static get observedAttributes(): string[] {
        return ['schema', 'disabled', 'loading']
    }

    constructor() {
        super()
        this._idPrefix = `tc-json-editor-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this._dataInitialised) {
                const { schema } = parseSchema(this.getAttribute('schema') ?? '')
                this._data = buildDefault(schema)
            }
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('input', this._onInput)
        this.addEventListener('change', this._onChange)
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('change', this._onChange)
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'schema' && !this._dataInitialised) {
            const { schema } = parseSchema(this.getAttribute('schema') ?? '')
            this._data = buildDefault(schema)
        }
        this.render()
    }

    get schema(): string {
        return this.getAttribute('schema') ?? ''
    }
    set schema(v: string) {
        setAttr(this, 'schema', v)
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

    get value(): Record<string, unknown> {
        return clone(this._data)
    }
    set value(v: Record<string, unknown>) {
        this._valueSet = true
        this._dataInitialised = true
        this._data = v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : {}
        if (this._initialised) this.render()
    }

    get defaultValue(): Record<string, unknown> | undefined {
        return this._defaultValue ? clone(this._defaultValue) : undefined
    }
    set defaultValue(v: Record<string, unknown> | undefined) {
        this._defaultValue = v && typeof v === 'object' && !Array.isArray(v) ? clone(v) : undefined
        // Only seeds the working copy while still uncontrolled and unedited.
        if (!this._valueSet) {
            this._dataInitialised = true
            this._data = this._defaultValue ? clone(this._defaultValue) : {}
            if (this._initialised) this.render()
        }
    }

    private _emit(): void {
        const value = clone(this._data)
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    private _onInput = (e: Event): void => {
        const t = e.target
        if (!(t instanceof HTMLInputElement)) return
        if (t.type !== 'text' && t.type !== 'number') return
        const pathAttr = t.getAttribute('data-path')
        if (pathAttr == null) return
        const kind = t.getAttribute('data-kind')
        const path = JSON.parse(pathAttr) as Path
        let val: unknown = t.value
        if (kind === 'number' || kind === 'integer') {
            const n = Number(t.value)
            val = Number.isNaN(n) ? 0 : kind === 'integer' ? Math.trunc(n) : n
        }
        this._dataInitialised = true
        setValueAtPath(this._data, path, val)
        this._emit()
    }

    private _onChange = (e: Event): void => {
        const t = e.target
        const pathAttr = t instanceof Element ? t.getAttribute('data-path') : null
        if (pathAttr == null) return
        const path = JSON.parse(pathAttr) as Path
        let val: unknown
        if (t instanceof HTMLSelectElement) {
            const kind = t.getAttribute('data-kind')
            val = kind === 'number' || kind === 'integer' ? Number(t.value) : t.value
        } else if (t instanceof HTMLInputElement && t.type === 'checkbox') {
            val = t.checked
        } else {
            return
        }
        this._dataInitialised = true
        setValueAtPath(this._data, path, val)
        this._emit()
    }

    private _onClick = (e: Event): void => {
        const target = (e.target as Element)?.closest<HTMLElement>('[data-action], [data-toggle]')
        if (!target || !this.contains(target)) return

        const toggleKey = target.getAttribute('data-toggle')
        if (toggleKey != null) {
            this._toggleGroup(toggleKey, target as HTMLButtonElement)
            return
        }
        if (this.disabled) return

        const action = target.getAttribute('data-action')
        const pathAttr = target.getAttribute('data-path')
        if (pathAttr == null) return
        const path = JSON.parse(pathAttr) as Path
        if (action === 'add') {
            this._addItem(path)
        } else if (action === 'remove') {
            const index = parseInt(target.getAttribute('data-index') ?? '-1', 10)
            this._removeItem(path, index)
        }
    }

    private _toggleGroup(pathKey: string, btn: HTMLButtonElement): void {
        if (this._collapsed.has(pathKey)) this._collapsed.delete(pathKey)
        else this._collapsed.add(pathKey)
        const collapsed = this._collapsed.has(pathKey)
        btn.setAttribute('aria-expanded', String(!collapsed))
        const bodyId = btn.getAttribute('aria-controls')
        const body = bodyId ? this.querySelector<HTMLElement>(`#${CSS.escape(bodyId)}`) : null
        if (body) body.hidden = collapsed
        const chevron = btn.querySelector('.tc-json-editor-chevron')
        if (chevron) chevron.classList.toggle('tc-json-editor-chevron--open', !collapsed)
    }

    private _addItem(path: Path): void {
        const { schema } = parseSchema(this.getAttribute('schema') ?? '')
        const prop = schemaPropAtPath(schema, path)
        if (!prop) return
        const arr = getValueAtPath(this._data, path)
        const items = Array.isArray(arr) ? arr : []
        const newItem =
            prop.properties && prop.properties.length > 0
                ? buildDefault(prop.properties)
                : typeDefault(prop.itemType)
        items.push(newItem)
        this._dataInitialised = true
        setValueAtPath(this._data, path, items)
        this.render()
        this._emit()
    }

    private _removeItem(path: Path, index: number): void {
        const arr = getValueAtPath(this._data, path)
        if (!Array.isArray(arr) || index < 0 || index >= arr.length) return
        arr.splice(index, 1)
        this._dataInitialised = true
        setValueAtPath(this._data, path, arr)
        this.render()
        this._emit()
    }

    private render(): void {
        const loading = this.loading
        const disabled = this.disabled

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const rows = Array.from({ length: 5 })
                .map(
                    () =>
                        `<div class="tc-json-editor-skeleton-row" aria-hidden="true"><span class="tc-json-editor-skeleton-key"></span><span class="tc-json-editor-skeleton-field"></span></div>`,
                )
                .join('')
            patchHtml(
                this,
                `<div class="tc-json-editor tc-json-editor--loading">${rows}<span class="visually-hidden">Loading…</span></div>`,
            )
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const { ok, schema, error } = parseSchema(this.getAttribute('schema') ?? '')

        if (!ok) {
            patchHtml(
                this,
                `<div class="tc-json-editor"><div class="tc-json-editor-error" role="alert">${esc(error ?? 'Invalid schema.')}</div></div>`,
            )
            return
        }

        const disabledClass = disabled ? ' tc-json-editor--disabled' : ''
        const body =
            schema.length > 0
                ? schema.map((prop) => this._renderProperty(prop, [prop.key])).join('')
                : `<div class="tc-json-editor-empty">No schema properties.</div>`

        patchHtml(this, `<div class="tc-json-editor${disabledClass}">${body}</div>`)
    }

    private _fieldId(): string {
        return `${this._idPrefix}-f${++this._fieldSeq}`
    }
    private _fieldSeq = 0

    private _groupBodyId(): string {
        return `${this._idPrefix}-g${++this._groupSeq}`
    }
    private _groupSeq = 0

    private _renderProperty(prop: JSONEditorSchemaProperty, path: Path): string {
        if (!prop || typeof prop.key !== 'string') return ''
        const value = getValueAtPath(this._data, path)
        const label = prop.label ?? prop.key

        if (prop.type === 'array') {
            return this._renderArray(prop, path, value, label)
        }
        if (prop.type === 'object') {
            return this._renderObject(prop, path, label)
        }
        return this._renderField(prop, path, value, label)
    }

    private _renderField(
        prop: JSONEditorSchemaProperty,
        path: Path,
        value: unknown,
        label: string,
    ): string {
        const fieldId = this._fieldId()
        const disabledAttr = this.disabled ? ' disabled' : ''
        const pathAttr = esc(JSON.stringify(path))
        let control: string

        if (Array.isArray(prop.enum) && prop.enum.length > 0) {
            const kind = prop.type === 'number' || prop.type === 'integer' ? prop.type : 'string'
            const opts = prop.enum
                .map((opt) => {
                    const ov = String(opt)
                    const selected = String(value ?? '') === ov ? ' selected' : ''
                    return `<option value="${esc(ov)}"${selected}>${esc(ov)}</option>`
                })
                .join('')
            control = `<select id="${fieldId}" class="form-select tc-json-editor-control" data-path="${pathAttr}" data-kind="${kind}"${disabledAttr}>${opts}</select>`
        } else if (prop.type === 'boolean') {
            const checked = value === true ? ' checked' : ''
            control = `<div class="form-check form-switch tc-json-editor-switch"><input id="${fieldId}" class="form-check-input" type="checkbox" role="switch" data-path="${pathAttr}" data-kind="boolean"${checked}${disabledAttr}></div>`
        } else if (prop.type === 'number' || prop.type === 'integer') {
            const v =
                typeof value === 'number'
                    ? value
                    : value == null || value === ''
                      ? ''
                      : Number(value)
            control = `<input id="${fieldId}" type="number" class="form-control tc-json-editor-control" value="${esc(String(v))}" data-path="${pathAttr}" data-kind="${prop.type}"${disabledAttr}>`
        } else {
            control = `<input id="${fieldId}" type="text" class="form-control tc-json-editor-control" value="${esc(String(value ?? ''))}" data-path="${pathAttr}" data-kind="string"${disabledAttr}>`
        }

        return (
            `<div class="tc-json-editor-row">` +
            `<label class="tc-json-editor-key" for="${fieldId}">${esc(label)}</label>` +
            `<div class="tc-json-editor-field">${control}</div>` +
            `</div>`
        )
    }

    private _renderObject(prop: JSONEditorSchemaProperty, path: Path, label: string): string {
        const pathKey = JSON.stringify(path)
        const collapsed = this._collapsed.has(pathKey)
        const bodyId = this._groupBodyId()
        const props = prop.properties ?? []
        const childHtml = props
            .map((child) => this._renderProperty(child, [...path, child.key]))
            .join('')

        return (
            `<div class="tc-json-editor-group">` +
            this._groupHeader(pathKey, bodyId, label, collapsed) +
            `<div class="tc-json-editor-group-body" id="${bodyId}" role="group" aria-label="${esc(label)}"${collapsed ? ' hidden' : ''}>${childHtml}</div>` +
            `</div>`
        )
    }

    private _renderArray(
        prop: JSONEditorSchemaProperty,
        path: Path,
        value: unknown,
        label: string,
    ): string {
        const pathKey = JSON.stringify(path)
        const collapsed = this._collapsed.has(pathKey)
        const bodyId = this._groupBodyId()
        const items = Array.isArray(value) ? value : []
        const pathAttr = esc(JSON.stringify(path))
        const disabledAttr = this.disabled ? ' disabled' : ''
        const isObjectArray = !!(prop.properties && prop.properties.length > 0)

        const rows = items
            .map((item, idx) => {
                const removeBtn = `<button type="button" class="tc-json-editor-icon-btn tc-json-editor-remove" data-action="remove" data-path="${pathAttr}" data-index="${idx}" aria-label="Remove ${esc(label)} item ${idx + 1}"${disabledAttr}>${removeIconHtml}</button>`
                if (isObjectArray) {
                    const fields = prop
                        .properties!.map((child) =>
                            this._renderProperty(child, [...path, idx, child.key]),
                        )
                        .join('')
                    return (
                        `<div class="tc-json-editor-array-item">` +
                        `<div class="tc-json-editor-array-item-head"><span class="tc-json-editor-array-index">#${idx + 1}</span>${removeBtn}</div>` +
                        `<div class="tc-json-editor-array-item-fields">${fields}</div>` +
                        `</div>`
                    )
                }
                const itemPath = [...path, idx]
                const itemPathAttr = esc(JSON.stringify(itemPath))
                const itemId = this._fieldId()
                const kind = prop.itemType ?? 'string'
                const itemLabel = `${label} item ${idx + 1}`
                let control: string
                if (kind === 'boolean') {
                    const checked = item === true ? ' checked' : ''
                    control = `<div class="form-check form-switch tc-json-editor-switch"><input id="${itemId}" class="form-check-input" type="checkbox" role="switch" aria-label="${esc(itemLabel)}" data-path="${itemPathAttr}" data-kind="boolean"${checked}${disabledAttr}></div>`
                } else if (kind === 'number' || kind === 'integer') {
                    control = `<input id="${itemId}" type="number" class="form-control tc-json-editor-control" value="${esc(String(typeof item === 'number' ? item : ''))}" aria-label="${esc(itemLabel)}" data-path="${itemPathAttr}" data-kind="${kind}"${disabledAttr}>`
                } else {
                    control = `<input id="${itemId}" type="text" class="form-control tc-json-editor-control" value="${esc(String(item ?? ''))}" aria-label="${esc(itemLabel)}" data-path="${itemPathAttr}" data-kind="string"${disabledAttr}>`
                }
                return `<div class="tc-json-editor-array-row">${control}${removeBtn}</div>`
            })
            .join('')

        const emptyHtml =
            items.length === 0 ? `<div class="tc-json-editor-empty">No items</div>` : ''
        const addBtn = `<button type="button" class="tc-json-editor-icon-btn tc-json-editor-add" data-action="add" data-path="${pathAttr}" aria-label="Add item to ${esc(label)}"${disabledAttr}>${plusIconHtml}</button>`

        return (
            `<div class="tc-json-editor-group tc-json-editor-array-group">` +
            this._groupHeader(
                pathKey,
                bodyId,
                label,
                collapsed,
                `<span class="tc-json-editor-count">${items.length} ${items.length === 1 ? 'item' : 'items'}</span>`,
                addBtn,
            ) +
            `<div class="tc-json-editor-array" id="${bodyId}" role="group" aria-label="${esc(label)}"${collapsed ? ' hidden' : ''}>${rows}${emptyHtml}</div>` +
            `</div>`
        )
    }

    private _groupHeader(
        pathKey: string,
        bodyId: string,
        label: string,
        collapsed: boolean,
        extra = '',
        trailing = '',
    ): string {
        const chevron = `<span class="tc-json-editor-chevron${collapsed ? '' : ' tc-json-editor-chevron--open'}" aria-hidden="true">${chevronIconHtml}</span>`
        return (
            `<div class="tc-json-editor-group-header">` +
            `<button type="button" class="tc-json-editor-toggle" data-toggle="${esc(pathKey)}" aria-expanded="${!collapsed}" aria-controls="${bodyId}">` +
            `${chevron}<span class="tc-json-editor-group-label">${esc(label)}</span></button>` +
            extra +
            trailing +
            `</div>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: JSONEditor
    }
}
