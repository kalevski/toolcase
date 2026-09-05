import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

// tc-condition-builder — a nested and/or tree of field · operator · value leaves.
//
// polovni.mk's `RuleEditor` (331 lines) with `RulesetRuleList`, `RulesetDryRun`
// and `RulesetImpact` around it; webgame.cloud has the adjacent `SchemaEditor` /
// `ConfigEditor` pair. Nothing in the library's 388 covers it, and both apps
// built one because a rule that a machine will evaluate has to be written in a
// vocabulary the machine already understands.
//
// THE VOCABULARY IS CLOSED, and that is the design. Fields come from `fields`,
// operators from each field's own list, so every control is a choice over
// something the evaluating side already accepts — the editor cannot express a
// rule the interpreter would choke on. Whatever consumes the tree will revalidate
// anyway; this is about not offering the mistake in the first place.
//
// A LEAF WITH NO FIELD IS NOT A LEAF. `add` inserts a row seeded with the first
// field and its first operator rather than an empty one, because a half-written
// condition in a saved tree is the failure mode a builder exists to prevent.
//
// The whole tree is element-owned markup driven by a JS property — there is no
// consumer node anywhere inside it, which is what makes redrawing a group on
// every edit safe.

const TAG_NAME = 'tc-condition-builder'

export interface ConditionField {
    /** The name the evaluating side knows this by. */
    key: string
    label: string
    /** Operators this field accepts. Falls back to the element's own default set. */
    operators?: string[]
    /** `select` renders the value as a closed list; anything else is typed. */
    type?: 'text' | 'number' | 'select' | 'boolean'
    /** Options for `type: 'select'`. */
    options?: Array<{ value: string; label: string }>
}

export interface ConditionLeaf {
    field: string
    operator: string
    value?: string | number | boolean | null
}

export interface ConditionGroup {
    /** `all` is AND, `any` is OR. */
    combinator: 'all' | 'any'
    children: ConditionNode[]
}

export type ConditionNode = ConditionGroup | ConditionLeaf

const isGroup = (node: ConditionNode): node is ConditionGroup =>
    (node as ConditionGroup).children !== undefined

/** Operators every field accepts unless it narrows the list itself. */
const DEFAULT_OPERATORS = ['eq', 'ne', 'lt', 'lte', 'gt', 'gte', 'in', 'isNull']

/** Operators that take no value — the row's value cell is dropped for these. */
const NULLARY = new Set(['isNull', 'isNotNull', 'isEmpty', 'isSet'])

export class ConditionBuilder extends HTMLElement {
    private _built = false
    private _fields: ConditionField[] = []
    private _value: ConditionGroup = { combinator: 'all', children: [] }
    private _root: HTMLElement | null = null
    private _labels: Record<string, string> = {}

    /** Invoked on every edit. The `tc-change` event is the primary API. */
    onChange: ((value: ConditionGroup) => void) | null = null

    static get observedAttributes(): string[] {
        return ['disabled', 'max-depth', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML('afterbegin', `<div class="tc-condition-builder__root"></div>`)
            this._root = this.querySelector(':scope > .tc-condition-builder__root')
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('change', this._onFieldChange)
        this.addEventListener('input', this._onFieldInput)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('change', this._onFieldChange)
        this.removeEventListener('input', this._onFieldInput)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The fields a condition may be written about. A JS property. */
    get fields(): ConditionField[] {
        return this._fields
    }
    set fields(v: ConditionField[]) {
        this._fields = Array.isArray(v) ? v : []
        if (this._built) this._render()
    }

    /** The tree. Always a group at the top — a bare leaf has no combinator, and a
     *  builder whose root can change shape is a builder with two code paths. */
    get value(): ConditionGroup {
        return this._value
    }
    set value(v: ConditionGroup) {
        this._value =
            v && Array.isArray(v.children)
                ? { combinator: v.combinator === 'any' ? 'any' : 'all', children: v.children }
                : { combinator: 'all', children: [] }
        if (this._built) this._render()
    }

    /**
     * Operator labels, keyed by operator name — `{ eq: 'is', gte: 'at least' }`.
     *
     * A JS property rather than the message registry: the operator SET is the
     * consumer's (it is whatever their evaluator accepts), so the library cannot
     * hold a catalog of names for operators it has never heard of. Unlabelled
     * operators render as their key, which is what an admin surface wants anyway.
     */
    get operatorLabels(): Record<string, string> {
        return this._labels
    }
    set operatorLabels(v: Record<string, string>) {
        this._labels = v && typeof v === 'object' ? v : {}
        if (this._built) this._render()
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    /** How deep a nested group may go. Beyond it the "add group" action is gone
     *  rather than disabled — an action that can never apply is not an action. */
    get maxDepth(): number {
        const raw = Number(this.getAttribute('max-depth'))
        return Number.isFinite(raw) && raw > 0 ? raw : 3
    }
    set maxDepth(v: number) {
        this.setAttribute('max-depth', String(v))
    }

    private patch(): void {
        setHostClass(this, 'tc-condition-builder')
        this._render()
    }

    // ── Tree addressing ──────────────────────────────────────────────────────
    //
    // Every row carries a PATH — "0.2.1" — rather than an id, so the tree needs no
    // identity of its own and a consumer can hand in plain JSON.

    private _at(path: number[]): ConditionNode | null {
        let node: ConditionNode = this._value
        for (const index of path) {
            if (!isGroup(node)) return null
            const next: ConditionNode | undefined = node.children[index]
            if (!next) return null
            node = next
        }
        return node
    }

    private _parentOf(path: number[]): ConditionGroup | null {
        const parent = this._at(path.slice(0, -1))
        return parent && isGroup(parent) ? parent : null
    }

    private _operatorsFor(key: string): string[] {
        const field = this._fields.find((f) => f.key === key)
        return field?.operators ?? DEFAULT_OPERATORS
    }

    private _newLeaf(): ConditionLeaf {
        const field = this._fields[0]
        return {
            field: field?.key ?? '',
            operator: this._operatorsFor(field?.key ?? '')[0] ?? 'eq',
            value: '',
        }
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private _render(): void {
        const root = this._root
        if (!root) return
        const html = this._group(this._value, [], 0)
        if (root.innerHTML !== html) root.innerHTML = html
    }

    private _group(group: ConditionGroup, path: number[], depth: number): string {
        const key = path.join('.')
        const disabled = this.disabled ? ' disabled' : ''
        const canNest = depth + 1 < this.maxDepth
        const removable = path.length > 0

        const combinator =
            `<span class="tc-condition-builder__combinator" role="group">` +
            (['all', 'any'] as const)
                .map(
                    (mode) =>
                        `<button type="button" class="tc-condition-builder__mode` +
                        (group.combinator === mode ? ' tc-condition-builder__mode--active' : '') +
                        `" data-action="combinator" data-path="${key}" data-mode="${mode}"` +
                        ` aria-pressed="${group.combinator === mode}"${disabled}>` +
                        `${mode === 'all' ? 'AND' : 'OR'}</button>`,
                )
                .join('') +
            `</span>`

        const children = group.children
            .map((child, index) =>
                isGroup(child)
                    ? this._group(child, [...path, index], depth + 1)
                    : this._leaf(child, [...path, index]),
            )
            .join('')

        return (
            `<div class="tc-condition-builder__group" data-depth="${depth}">` +
            `<div class="tc-condition-builder__group-head">` +
            combinator +
            (removable
                ? `<button type="button" class="tc-condition-builder__remove"` +
                  ` data-action="remove" data-path="${key}" aria-label="Remove group"${disabled}>` +
                  `${lucideByName('X')}</button>`
                : '') +
            `</div>` +
            `<div class="tc-condition-builder__children">${children}</div>` +
            `<div class="tc-condition-builder__group-actions">` +
            `<button type="button" class="tc-condition-builder__add"` +
            ` data-action="add-leaf" data-path="${key}"${disabled}>+ condition</button>` +
            (canNest
                ? `<button type="button" class="tc-condition-builder__add"` +
                  ` data-action="add-group" data-path="${key}"${disabled}>+ group</button>`
                : '') +
            `</div>` +
            `</div>`
        )
    }

    private _leaf(leaf: ConditionLeaf, path: number[]): string {
        const key = path.join('.')
        const disabled = this.disabled ? ' disabled' : ''
        const field = this._fields.find((f) => f.key === leaf.field)

        const fieldCell =
            `<select class="tc-condition-builder__field" data-action="field" data-path="${key}"${disabled}>` +
            this._fields
                .map(
                    (entry) =>
                        `<option value="${esc(entry.key)}"` +
                        `${entry.key === leaf.field ? ' selected' : ''}>${esc(entry.label)}</option>`,
                )
                .join('') +
            `</select>`

        const operatorCell =
            `<select class="tc-condition-builder__operator" data-action="operator" data-path="${key}"${disabled}>` +
            this._operatorsFor(leaf.field)
                .map(
                    (operator) =>
                        `<option value="${esc(operator)}"` +
                        `${operator === leaf.operator ? ' selected' : ''}>` +
                        `${esc(this._labels[operator] ?? operator)}</option>`,
                )
                .join('') +
            `</select>`

        // A nullary operator has no value cell at all. Rendering a disabled input
        // beside "is null" is a control that says "type something here" about a
        // condition that takes nothing.
        const raw = leaf.value == null ? '' : String(leaf.value)
        const valueCell = NULLARY.has(leaf.operator)
            ? ''
            : field?.type === 'select'
              ? `<select class="tc-condition-builder__value" data-action="value" data-path="${key}"${disabled}>` +
                (field.options ?? [])
                    .map(
                        (option) =>
                            `<option value="${esc(option.value)}"` +
                            `${option.value === raw ? ' selected' : ''}>${esc(option.label)}</option>`,
                    )
                    .join('') +
                `</select>`
              : `<input class="tc-condition-builder__value" data-action="value" data-path="${key}"` +
                ` type="${field?.type === 'number' ? 'number' : 'text'}"` +
                ` value="${esc(raw)}"${disabled}>`

        return (
            `<div class="tc-condition-builder__leaf">` +
            fieldCell +
            operatorCell +
            valueCell +
            `<button type="button" class="tc-condition-builder__remove"` +
            ` data-action="remove" data-path="${key}" aria-label="Remove condition"${disabled}>` +
            `${lucideByName('X')}</button>` +
            `</div>`
        )
    }

    // ── Editing ──────────────────────────────────────────────────────────────

    private _emit(): void {
        this._render()
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value: this._value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }

    private _path(el: HTMLElement): number[] {
        const raw = el.dataset.path ?? ''
        return raw === '' ? [] : raw.split('.').map(Number)
    }

    private _onClick = (event: MouseEvent): void => {
        if (this.disabled) return
        const origin = event.target as Element | null
        const button = origin?.closest<HTMLButtonElement>('[data-action]')
        if (!button || button.tagName !== 'BUTTON') return
        const path = this._path(button)
        const action = button.dataset.action

        if (action === 'combinator') {
            const group = this._at(path)
            if (!group || !isGroup(group)) return
            const mode = button.dataset.mode === 'any' ? 'any' : 'all'
            if (group.combinator === mode) return
            group.combinator = mode
            this._emit()
            return
        }
        if (action === 'add-leaf' || action === 'add-group') {
            const group = this._at(path)
            if (!group || !isGroup(group)) return
            group.children = [
                ...group.children,
                action === 'add-leaf'
                    ? this._newLeaf()
                    : ({ combinator: 'all', children: [] } as ConditionGroup),
            ]
            this._emit()
            return
        }
        if (action === 'remove') {
            const parent = this._parentOf(path)
            if (!parent) return
            const index = path[path.length - 1]
            parent.children = parent.children.filter((_, i) => i !== index)
            this._emit()
        }
    }

    private _onFieldChange = (event: Event): void => {
        if (this.disabled) return
        const control = event.target
        if (!(control instanceof HTMLSelectElement)) return
        const action = control.dataset.action
        if (action !== 'field' && action !== 'operator' && action !== 'value') return
        const leaf = this._at(this._path(control))
        if (!leaf || isGroup(leaf)) return

        if (action === 'field') {
            leaf.field = control.value
            // The operator set is per field, so an operator the new field does not
            // accept has to go — silently keeping it is how a tree ends up holding a
            // condition the evaluator rejects.
            const operators = this._operatorsFor(leaf.field)
            if (!operators.includes(leaf.operator)) leaf.operator = operators[0] ?? 'eq'
        } else if (action === 'operator') {
            leaf.operator = control.value
        } else {
            leaf.value = control.value
        }
        this._emit()
    }

    private _onFieldInput = (event: Event): void => {
        if (this.disabled) return
        const control = event.target
        if (!(control instanceof HTMLInputElement)) return
        if (control.dataset.action !== 'value') return
        const leaf = this._at(this._path(control))
        if (!leaf || isGroup(leaf)) return
        leaf.value = control.value
        // Notify WITHOUT redrawing: this is a keystroke in the field the reader is
        // in, and re-rendering the row would drop their caret.
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value: this._value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConditionBuilder
    }
}
