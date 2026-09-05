import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { msg } from './messages'
import { setAttr } from './internal/tc-element'

// tc-tree-picker — pick one or many leaves out of a hierarchy, by searching or by
// drilling into it.
//
// From polovni.mk's `LocationPicker` + `LocationTree` (270 + 153 lines), with the
// place vocabulary taken out. Nothing about "search a tree, walk into a level,
// tick some leaves, see where you are" is about places.
//
// TWO TREE ELEMENTS IN THIS LIBRARY, and they answer different questions:
//   tc-tree-view    SHOWS a hierarchy. Expand/collapse in place, everything
//                   visible at once, no notion of a current level.
//   tc-tree-picker  this one. PICKS out of a hierarchy. One level at a time with
//                   a breadcrumb back out, because a phone screen cannot show a
//                   four-deep tree and a reader narrowing a filter does not want
//                   to see the branches they have already rejected.
//
// SEARCH FLATTENS. Typing switches the list from "the current level" to "every
// node whose label matches, wherever it lives", each row carrying its own path —
// which is the only way a four-deep tree is usable on a phone, and the reason the
// breadcrumb is a display of state rather than the only way to move.

const TAG_NAME = 'tc-tree-picker'

export interface TreePickerNode {
    id: string
    label: string
    /** Extra terms the search matches and never renders. */
    keywords?: string[]
    children?: TreePickerNode[]
    disabled?: boolean
}

export interface TreePickerChangeDetail {
    /** Every selected id, in selection order. */
    value: string[]
}

interface FlatNode {
    node: TreePickerNode
    /** Ancestor labels, outermost first. */
    path: string[]
}

export class TreePicker extends HTMLElement {
    private _built = false
    private _nodes: TreePickerNode[] = []
    private _value: string[] = []
    /** Ids of the ancestors of the level currently shown, outermost first. */
    private _trail: string[] = []
    private _query = ''
    private _list: HTMLElement | null = null

    /** Invoked on every change. The `tc-change` event is the primary API. */
    onChange: ((value: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['multiple', 'placeholder', 'search-placeholder', 'empty-message', 'class']
    }

    connectedCallback(): void {
        if (!this._built) {
            this.insertAdjacentHTML(
                'afterbegin',
                `<span class="tc-tree-picker__search">` +
                    `<input class="tc-tree-picker__input" type="search" autocomplete="off">` +
                    `</span>` +
                    `<nav class="tc-tree-picker__trail"></nav>` +
                    `<div class="tc-tree-picker__list" role="listbox"></div>` +
                    `<p class="tc-tree-picker__empty"></p>`,
            )
            this._list = this.querySelector(':scope > .tc-tree-picker__list')
            this._built = true
        }
        this.addEventListener('click', this._onClick)
        this.addEventListener('input', this._onInput)
        this.patch()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('input', this._onInput)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._built) return
        this.patch()
    }

    /** The hierarchy. A JS property: React cannot pass a tree as an attribute. */
    get nodes(): TreePickerNode[] {
        return this._nodes
    }
    set nodes(v: TreePickerNode[]) {
        this._nodes = Array.isArray(v) ? v : []
        this._trail = []
        if (this._built) this._renderList()
    }

    /** The picked ids. Always an array, even for a single-select picker. */
    get value(): string[] {
        return this._value
    }
    set value(v: string[]) {
        this._value = Array.isArray(v) ? [...v] : []
        if (this._built) this._renderList()
    }

    /** Many leaves rather than one. Single-select closes over the first pick. */
    get multiple(): boolean {
        return this.hasAttribute('multiple')
    }
    set multiple(v: boolean) {
        if (v) this.setAttribute('multiple', '')
        else this.removeAttribute('multiple')
    }

    get searchPlaceholder(): string {
        return this.getAttribute('search-placeholder') ?? msg('searchPlaceholder')
    }
    set searchPlaceholder(v: string) {
        setAttr(this, 'search-placeholder', v)
    }

    get emptyMessage(): string {
        return this.getAttribute('empty-message') ?? msg('noData')
    }
    set emptyMessage(v: string) {
        setAttr(this, 'empty-message', v)
    }

    /** Walk back out to the root and clear the search. */
    reset(): void {
        this._trail = []
        this._query = ''
        const input = this.querySelector<HTMLInputElement>('.tc-tree-picker__input')
        if (input) input.value = ''
        this._renderList()
    }

    private patch(): void {
        setHostClass(this, 'tc-tree-picker')
        const input = this.querySelector<HTMLInputElement>('.tc-tree-picker__input')
        if (input) {
            input.placeholder = this.searchPlaceholder
            input.setAttribute('aria-label', msg('searchOptionsLabel'))
        }
        this._renderList()
    }

    // ── Tree walking ─────────────────────────────────────────────────────────

    private _levelNodes(): TreePickerNode[] {
        let level = this._nodes
        for (const id of this._trail) {
            const found = level.find((n) => n.id === id)
            if (!found?.children) return []
            level = found.children
        }
        return level
    }

    private _trailLabels(): string[] {
        const labels: string[] = []
        let level = this._nodes
        for (const id of this._trail) {
            const found = level.find((n) => n.id === id)
            if (!found) break
            labels.push(found.label)
            level = found.children ?? []
        }
        return labels
    }

    /** Every node whose label or keywords match, with the path it lives under. */
    private _matches(query: string): FlatNode[] {
        const needle = query.trim().toLowerCase()
        if (needle === '') return []
        const out: FlatNode[] = []
        const walk = (nodes: TreePickerNode[], path: string[]): void => {
            for (const node of nodes) {
                const hay = [node.label, ...(node.keywords ?? [])].join(' ').toLowerCase()
                if (hay.includes(needle)) out.push({ node, path })
                if (node.children) walk(node.children, [...path, node.label])
            }
        }
        walk(this._nodes, [])
        return out
    }

    // ── Rendering ────────────────────────────────────────────────────────────
    //
    // Both the trail and the list are containers this element owns outright, so
    // rewriting them cannot touch a consumer node.

    private _renderList(): void {
        const list = this._list
        if (!list) return
        const searching = this._query.trim() !== ''
        const rows = searching
            ? this._matches(this._query)
            : this._levelNodes().map((node) => ({ node, path: [] as string[] }))

        const html = rows
            .map(({ node, path }) => {
                const selected = this._value.includes(node.id)
                const branch = !searching && (node.children?.length ?? 0) > 0
                const where = path.length
                    ? `<span class="tc-tree-picker__where">${esc(path.join(' / '))}</span>`
                    : ''
                const chevron = branch
                    ? `<span class="tc-tree-picker__chevron">${lucideByName('ChevronRight')}</span>`
                    : ''
                return (
                    `<button type="button" class="tc-tree-picker__row" role="option"` +
                    ` data-id="${esc(node.id)}" data-branch="${branch}"` +
                    ` aria-selected="${selected}"${node.disabled ? ' disabled' : ''}>` +
                    `<span class="tc-tree-picker__labels">` +
                    where +
                    `<span class="tc-tree-picker__label">${esc(node.label)}</span>` +
                    `</span>` +
                    chevron +
                    `</button>`
                )
            })
            .join('')
        if (list.innerHTML !== html) list.innerHTML = html
        list.setAttribute('aria-multiselectable', String(this.multiple))

        const empty = this.querySelector<HTMLElement>(':scope > .tc-tree-picker__empty')
        if (empty) {
            const text = this.emptyMessage
            if (empty.textContent !== text) empty.textContent = text
            empty.hidden = rows.length > 0
        }
        this._renderTrail(searching)
    }

    private _renderTrail(searching: boolean): void {
        const trail = this.querySelector<HTMLElement>(':scope > .tc-tree-picker__trail')
        if (!trail) return
        const labels = this._trailLabels()
        // A breadcrumb with one crumb is a label, not a path — and while a search is
        // running the list is not a level, so there is nothing for it to describe.
        const show = !searching && labels.length > 0
        const html = show
            ? `<button type="button" class="tc-tree-picker__crumb" data-depth="0">` +
              `${lucideByName('ChevronLeft')}</button>` +
              labels
                  .map(
                      (label, index) =>
                          `<button type="button" class="tc-tree-picker__crumb"` +
                          ` data-depth="${index + 1}">${esc(label)}</button>`,
                  )
                  .join('')
            : ''
        if (trail.innerHTML !== html) trail.innerHTML = html
        trail.hidden = !show
    }

    // ── Interaction ──────────────────────────────────────────────────────────

    private _emit(): void {
        const detail: TreePickerChangeDetail = { value: [...this._value] }
        this.dispatchEvent(new CustomEvent('tc-change', { bubbles: true, composed: true, detail }))
        if (typeof this.onChange === 'function') this.onChange([...this._value])
    }

    private _toggle(id: string): void {
        if (!this.multiple) {
            this._value = this._value[0] === id ? [] : [id]
        } else if (this._value.includes(id)) {
            this._value = this._value.filter((entry) => entry !== id)
        } else {
            this._value = [...this._value, id]
        }
        this._renderList()
        this._emit()
    }

    private _onClick = (event: MouseEvent): void => {
        const origin = event.target as Element | null
        if (!origin) return

        const crumb = origin.closest<HTMLButtonElement>('.tc-tree-picker__crumb')
        if (crumb) {
            this._trail = this._trail.slice(0, Number(crumb.dataset.depth ?? 0))
            this._renderList()
            return
        }

        const row = origin.closest<HTMLButtonElement>('.tc-tree-picker__row')
        if (!row || row.disabled) return
        const id = row.dataset.id ?? ''
        // A branch is a way IN, not a value. Ticking a branch would claim every leaf
        // under it, which is a different control (`tc-checkbox-group` over a level).
        if (row.dataset.branch === 'true') {
            this._trail = [...this._trail, id]
            this._renderList()
            return
        }
        this._toggle(id)
    }

    private _onInput = (event: Event): void => {
        const input = event.target
        if (!(input instanceof HTMLInputElement)) return
        if (!input.classList.contains('tc-tree-picker__input')) return
        this._query = input.value
        // A search is a view of the WHOLE tree, so it leaves the current level
        // behind rather than filtering inside it.
        this._renderList()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TreePicker
    }
}
