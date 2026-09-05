import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-data-list'

export interface DataListActionDetail {
    action: string
    id: string
}

export interface DataListSelectDetail {
    id: string
}

export interface DataListEventMap {
    'tc-action': CustomEvent<DataListActionDetail>
    'tc-select': CustomEvent<DataListSelectDetail>
}

/** Row renderer hook — returns the full markup for one row (typically an `<li>`). */
export type DataListRenderRow = (item: any, index: number) => string

/**
 * tc-data-list — a generic, data-driven row list. It owns the shared skeleton
 * every domain list repeats: an `items` array that re-renders on assignment, an
 * optional `list-title` header, an `empty-text` fallback, delegated per-row
 * action buttons (`tc-action`), and an optional single-select listbox mode
 * (`selectable` + `selected-id` → `tc-select`).
 *
 * Domain rendering is supplied by the consumer via the `renderRow` function
 * property — `el.renderRow = (item, i) => '<li …>'`. Each row must carry a
 * `data-id` so the delegated action/select handlers can resolve which item was
 * acted on; an action button inside a row marks itself with `data-action="…"`.
 * Without a `renderRow` the element falls back to a built-in row that reads
 * `id` / `label` / `secondary` / `trailing` off each item.
 *
 * This element replaces the family of near-identical "render an array of rows"
 * components (mute / team / credits / achievement / … lists): the skeleton lives
 * here once and each former list becomes a `renderRow` at the call site.
 */
export class DataList extends HTMLElement {
    private _initialised = false
    private _items: any[] = []
    private _renderRow: DataListRenderRow | null = null

    // Optional callback mirrors of the tc-action / tc-select events.
    onAction: ((detail: DataListActionDetail) => void) | null = null
    onSelect: ((detail: DataListSelectDetail) => void) | null = null

    static get observedAttributes(): string[] {
        return ['list-title', 'empty-text', 'selectable', 'selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // selected-id only repaints the selection state — no full rebuild, so an
        // in-progress keyboard focus survives.
        if (name === 'selected-id') {
            this._syncSelection()
            return
        }
        this.render()
    }

    get items(): any[] {
        return this._items.slice()
    }
    set items(value: any[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    /** Row renderer. Assign a function returning the full row markup per item. */
    get renderRow(): DataListRenderRow | null {
        return this._renderRow
    }
    set renderRow(fn: DataListRenderRow | null) {
        this._renderRow = typeof fn === 'function' ? fn : null
        if (this._initialised) this.render()
    }

    get listTitle(): string {
        return this.getAttribute('list-title') ?? ''
    }
    set listTitle(v: string) {
        if (v) this.setAttribute('list-title', v)
        else this.removeAttribute('list-title')
    }

    get emptyText(): string {
        return this.getAttribute('empty-text') ?? 'Nothing to show.'
    }
    set emptyText(v: string) {
        if (v) this.setAttribute('empty-text', v)
        else this.removeAttribute('empty-text')
    }

    get selectable(): boolean {
        return this.hasAttribute('selectable')
    }
    set selectable(v: boolean) {
        if (v) this.setAttribute('selectable', '')
        else this.removeAttribute('selectable')
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(v: string) {
        if (v) this.setAttribute('selected-id', v)
        else this.removeAttribute('selected-id')
    }

    // Built-in row used only when no `renderRow` is supplied. Reads conventional
    // fields off the item so trivial lists work with zero config.
    private _defaultRow(item: any, index: number): string {
        const id = item?.id ?? String(index)
        const label = item?.label ?? item?.name ?? item?.title ?? String(item)
        const secondary = item?.secondary ?? item?.description ?? ''
        const trailing = item?.trailing ?? ''
        const selectable = this.selectable

        const secondaryHtml = secondary
            ? `<span class="tc-data-list__secondary">${esc(secondary)}</span>`
            : ''
        const trailingHtml = trailing
            ? `<span class="tc-data-list__trailing">${esc(trailing)}</span>`
            : ''
        const roleAttr = selectable
            ? ' role="option" tabindex="0" aria-selected="false"'
            : ' role="listitem"'

        return (
            `<li class="tc-data-list__row" data-id="${esc(id)}"${roleAttr}>` +
            `<div class="tc-data-list__text">` +
            `<span class="tc-data-list__primary">${esc(label)}</span>` +
            secondaryHtml +
            `</div>` +
            trailingHtml +
            `</li>`
        )
    }

    private render(): void {
        this.classList.add('tc-data-list')

        const title = this.listTitle
        const headerHtml = title
            ? `<div class="tc-data-list__header"><span class="tc-data-list__title">${esc(title)}</span></div>`
            : ''

        let bodyInner: string
        if (this._items.length === 0) {
            bodyInner = `<li class="tc-data-list__empty">${esc(this.emptyText)}</li>`
        } else {
            const fn = this._renderRow ?? ((it: any, i: number) => this._defaultRow(it, i))
            bodyInner = this._items.map((it, i) => fn(it, i)).join('')
        }

        const bodyRole = this.selectable ? 'listbox' : 'list'
        patchHtml(
            this,
            headerHtml + `<ul class="tc-data-list__body" role="${bodyRole}">${bodyInner}</ul>`,
        )

        this._wire()
        this._syncSelection()
    }

    // Reflect `selected-id` onto the rendered rows (selectable mode only).
    private _syncSelection(): void {
        if (!this.selectable) return
        const selected = this.selectedId
        const rows = this.querySelectorAll<HTMLElement>('.tc-data-list__row[data-id]')
        rows.forEach((row) => {
            const isSel = row.dataset.id === selected && selected !== ''
            row.classList.toggle('tc-data-list__row--selected', isSel)
            row.setAttribute('aria-selected', isSel ? 'true' : 'false')
        })
    }

    private _emitSelect(id: string): void {
        this.selectedId = id
        this.dispatchEvent(
            new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } }),
        )
        if (typeof this.onSelect === 'function') this.onSelect({ id })
    }

    // Delegated listeners on `.tc-data-list__body` — patchHtml reuses that <ul>
    // across renders (rather than recreating it), so `bindOnce` replaces the
    // previous closure instead of stacking a second listener on top of it.
    private _wire(): void {
        const body = this.querySelector<HTMLElement>('.tc-data-list__body')
        if (!body) return

        bindOnce(body, 'click', (e: Event) => {
            const target = e.target as Element
            const btn = target.closest<HTMLButtonElement>('[data-action]')
            const row = target.closest<HTMLElement>('.tc-data-list__row[data-id]')
            const id = row?.dataset.id ?? ''

            if (btn && !btn.disabled) {
                e.stopPropagation()
                const action = btn.dataset.action ?? ''
                this.dispatchEvent(
                    new CustomEvent('tc-action', {
                        bubbles: true,
                        composed: true,
                        detail: { action, id },
                    }),
                )
                if (typeof this.onAction === 'function') this.onAction({ action, id })
                return
            }

            if (this.selectable && row) this._emitSelect(id)
        })

        // Bound unconditionally (state checked inside the handler, not at bind
        // time): `body` is reused across renders (patchHtml), so a listener only
        // bound while `selectable` happened to be true would otherwise keep
        // firing forever after `selectable` is later removed — a custom
        // `renderRow` has no way to know the current `selectable` value and may
        // keep marking rows `tabindex="0"` regardless.
        bindOnce(body, 'keydown', (e: KeyboardEvent) => {
            if (!this.selectable) return
            if (e.key !== 'Enter' && e.key !== ' ') return
            const target = e.target as Element
            if (target.closest('button')) return
            const row = target.closest<HTMLElement>('.tc-data-list__row[data-id]')
            if (!row) return
            e.preventDefault()
            this._emitSelect(row.dataset.id ?? '')
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DataList
    }
}
