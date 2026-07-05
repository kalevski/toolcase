import { esc } from './internal/esc'
import { icon } from './icons'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-static'

const TAG_NAME = 'tc-advanced-table'

// Sort affordance icons: a faint chevrons-up-down on every sortable header,
// resolving to a single up/down chevron (in --tc-text) on the active column.
const chevronUpIcon = icon(ChevronUp, 'tc-advanced-table-sort-icon')
const chevronDownIcon = icon(ChevronDown, 'tc-advanced-table-sort-icon')
const chevronsUpDownIcon = icon(ChevronsUpDown, 'tc-advanced-table-sort-icon')

export type AdvancedTableAlign = 'left' | 'center' | 'right'
const ALIGNS: AdvancedTableAlign[] = ['left', 'center', 'right']

export type AdvancedTableSortDirection = 'asc' | 'desc'

export interface AdvancedTableSort {
    column: string
    direction: AdvancedTableSortDirection
}

export interface AdvancedTableFilterOption {
    value: string
    label: string
}

export interface AdvancedTableFilter {
    key: string
    label: string
    type: 'text' | 'select'
    options?: AdvancedTableFilterOption[]
    placeholder?: string
}

// Header descriptors. The React AdvancedTable inherits `columns` from TableProps;
// here the header row is driven by this JS property while body rows are projected
// as slotted <tr> children.
export interface AdvancedTableColumn {
    key: string
    label: string
    align?: AdvancedTableAlign
    width?: string
}

export class AdvancedTable extends HTMLElement {
    private _initialised = false

    private _filters: AdvancedTableFilter[] = []
    private _filterValues: Record<string, any> = {}
    private _sortableColumns: string[] = []
    private _sort: AdvancedTableSort | null = null
    private _columns: AdvancedTableColumn[] = []
    private _rowsHtml: string | null = null

    // Callback mirrors of the dispatched CustomEvents.
    onFilterChange: ((key: string, value: any) => void) | null = null
    onSortChange: ((sort: AdvancedTableSort | null) => void) | null = null
    onPageChange: ((offset: number) => void) | null = null

    static get observedAttributes(): string[] {
        return ['limit', 'offset', 'total', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const body = this.querySelector('.tc-advanced-table-body')
            if (body) {
                if (this._rowsHtml != null) body.innerHTML = this._rowsHtml
                else slotContent.forEach((n) => body.appendChild(n))
            }
            this._initialised = true
        }
        this.addEventListener('input', this._onInput)
        this.addEventListener('change', this._onChange)
        this.addEventListener('click', this._onClick)
        // The footer pager is a canonical <tc-pagination> that emits its own
        // tc-page-change ({ page }). Intercept it before it bubbles to consumers
        // and translate the 1-based page into this table's offset model.
        this.addEventListener('tc-page-change', this._onPaginationPage)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('change', this._onChange)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('tc-page-change', this._onPaginationPage)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    // ── Number attributes ─────────────────────────────────────────────────────

    get limit(): number {
        return Math.max(1, parseInt(this.getAttribute('limit') ?? '10', 10) || 10)
    }
    set limit(v: number) {
        this.setAttribute('limit', String(v))
    }

    get offset(): number {
        return Math.max(0, parseInt(this.getAttribute('offset') ?? '0', 10) || 0)
    }
    set offset(v: number) {
        this.setAttribute('offset', String(v))
    }

    get total(): number {
        return Math.max(0, parseInt(this.getAttribute('total') ?? '0', 10) || 0)
    }
    set total(v: number) {
        this.setAttribute('total', String(v))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS properties ─────────────────────────────────────────────────────────

    get filters(): AdvancedTableFilter[] {
        return this._filters
    }
    set filters(v: AdvancedTableFilter[]) {
        this._filters = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get filterValues(): Record<string, any> {
        return this._filterValues
    }
    set filterValues(v: Record<string, any>) {
        this._filterValues = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        if (this._initialised) this._rerenderWithSlots()
    }

    get sortableColumns(): string[] {
        return this._sortableColumns
    }
    set sortableColumns(v: string[]) {
        this._sortableColumns = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get sort(): AdvancedTableSort | null {
        return this._sort
    }
    set sort(v: AdvancedTableSort | null) {
        this._sort = v && typeof v === 'object' && typeof v.column === 'string' ? v : null
        if (this._initialised) this._rerenderWithSlots()
    }

    get columns(): AdvancedTableColumn[] {
        return this._columns
    }
    set columns(v: AdvancedTableColumn[]) {
        this._columns = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    /**
     * Body rows as a trusted HTML string of `<tr>` elements — the component owns
     * the `<tbody>` and re-applies this on every re-render. This is the ONLY
     * relocation-safe way to feed rows from a framework (React children would be
     * captured and moved out from under the framework's reconciler; raw `<tr>`
     * children in static HTML never survive parsing outside a `<table>`).
     * Interpolated user data MUST be escaped by the caller.
     */
    get rows(): string | null {
        return this._rowsHtml
    }
    set rows(v: string | null) {
        this._rowsHtml = typeof v === 'string' ? v : null
        if (this._initialised) this._rerenderWithSlots()
    }

    // ── Event delegation ──────────────────────────────────────────────────────

    private _onInput = (e: Event): void => {
        const t = e.target as HTMLElement
        if (t instanceof HTMLInputElement && t.dataset.filterKey) {
            this._emitFilter(t.dataset.filterKey, t.value)
        }
    }

    private _onChange = (e: Event): void => {
        const t = e.target as HTMLElement
        if (t instanceof HTMLSelectElement && t.dataset.filterKey) {
            this._emitFilter(t.dataset.filterKey, t.value)
        }
    }

    private _onClick = (e: Event): void => {
        const el = e.target as HTMLElement

        const sortBtn = el.closest<HTMLButtonElement>('[data-sort-key]')
        if (sortBtn && this.contains(sortBtn)) {
            if (this.loading || sortBtn.disabled) return
            this._cycleSort(sortBtn.dataset.sortKey ?? '')
        }
    }

    // The nested tc-pagination dispatches tc-page-change with a 1-based { page }.
    // Swallow it (so consumers only ever see this table's own offset-based event)
    // and forward as an offset jump. stopImmediatePropagation — not stopPropagation —
    // because consumers listen on THIS host element too: plain stopPropagation only
    // blocks ancestors, so the inner { page } event would still reach a host-level
    // listener whose handler reads detail.offset (undefined → page resets). This
    // listener binds in connectedCallback, before any consumer can attach, so it
    // always intercepts first.
    private _onPaginationPage = (e: Event): void => {
        const target = e.target as HTMLElement
        if (!(target instanceof HTMLElement) || target.tagName.toLowerCase() !== 'tc-pagination')
            return
        e.stopImmediatePropagation()
        const page = (e as CustomEvent).detail?.page
        if (typeof page !== 'number') return
        this._goToPage(page)
    }

    // ── Behaviour ─────────────────────────────────────────────────────────────

    private _emitFilter(key: string, value: any): void {
        // Filter events do NOT re-render — the consumer owns filterValues and
        // re-renders by setting it back, so input focus is never disturbed here.
        this.dispatchEvent(
            new CustomEvent('tc-filter-change', {
                bubbles: true,
                composed: true,
                detail: { key, value },
            }),
        )
        if (typeof this.onFilterChange === 'function') this.onFilterChange(key, value)
    }

    private _cycleSort(key: string): void {
        if (!key) return
        const cur = this._sort
        let next: AdvancedTableSort | null
        if (!cur || cur.column !== key) next = { column: key, direction: 'asc' }
        else if (cur.direction === 'asc') next = { column: key, direction: 'desc' }
        else next = null

        this._sort = next
        this._rerenderWithSlots()

        this.dispatchEvent(
            new CustomEvent('tc-sort-change', {
                bubbles: true,
                composed: true,
                detail: { column: next?.column ?? null, direction: next?.direction ?? null },
            }),
        )
        if (typeof this.onSortChange === 'function') this.onSortChange(next)
    }

    private _goToPage(page: number): void {
        if (this.loading) return
        const limit = this.limit
        const total = this.total
        const pageCount = Math.max(1, Math.ceil(total / limit))
        const clamped = Math.min(Math.max(1, page), pageCount)
        const next = (clamped - 1) * limit
        if (next === this.offset) return

        this.setAttribute('offset', String(next)) // → attributeChangedCallback → render
        this.dispatchEvent(
            new CustomEvent('tc-page-change', {
                bubbles: true,
                composed: true,
                detail: { offset: next },
            }),
        )
        if (typeof this.onPageChange === 'function') this.onPageChange(next)
    }

    // ── Render ────────────────────────────────────────────────────────────────

    // Re-render while preserving body rows (the `rows` HTML string when set, else
    // the slotted nodes) and the active filter input's focus + caret position (a
    // full innerHTML rewrite would otherwise drop both).
    private _rerenderWithSlots(): void {
        const active = this.querySelector<HTMLElement>('[data-filter-key]:focus')
        const focusKey = active?.dataset.filterKey ?? null
        const caret = active instanceof HTMLInputElement ? active.selectionStart : null

        const body = this.querySelector('.tc-advanced-table-body')
        const rows = this._rowsHtml == null && body ? Array.from(body.childNodes) : []

        this.render()

        const newBody = this.querySelector('.tc-advanced-table-body')
        if (newBody) {
            if (this._rowsHtml != null) newBody.innerHTML = this._rowsHtml
            else rows.forEach((n) => newBody.appendChild(n))
        }

        if (focusKey) {
            const el = this.querySelector<HTMLElement>(`[data-filter-key="${focusKey}"]`)
            if (el) {
                el.focus()
                if (el instanceof HTMLInputElement && caret != null) {
                    try {
                        el.setSelectionRange(caret, caret)
                    } catch {
                        /* non-text input */
                    }
                }
            }
        }
    }

    private _renderToolbar(): string {
        if (this._filters.length === 0) return ''
        const loading = this.loading

        const controls = this._filters
            .map((f) => {
                const raw = this._filterValues[f.key]
                const value = raw == null ? '' : String(raw)
                const disabledAttr = loading ? ' disabled' : ''
                const key = esc(f.key)
                const label = esc(f.label)

                let control: string
                if (f.type === 'select') {
                    const placeholder = f.placeholder
                        ? `<option value=""${value === '' ? ' selected' : ''}>${esc(f.placeholder)}</option>`
                        : ''
                    const opts = (f.options ?? [])
                        .map(
                            (o) =>
                                `<option value="${esc(o.value)}"${o.value === value ? ' selected' : ''}>${esc(o.label)}</option>`,
                        )
                        .join('')
                    control =
                        `<select class="form-select form-select-sm tc-advanced-table-filter-control" ` +
                        `data-filter-key="${key}" aria-label="${label}"${disabledAttr}>${placeholder}${opts}</select>`
                } else {
                    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''
                    control =
                        `<input type="text" class="form-control form-control-sm tc-advanced-table-filter-control" ` +
                        `data-filter-key="${key}" value="${esc(value)}" aria-label="${label}"${ph}${disabledAttr}>`
                }

                return (
                    `<div class="tc-advanced-table-filter">` +
                    `<label class="tc-advanced-table-filter-label">${label}</label>${control}</div>`
                )
            })
            .join('')

        return `<div class="tc-advanced-table-toolbar" role="group" aria-label="Filters">${controls}</div>`
    }

    private _renderHead(): string {
        if (this._columns.length === 0) {
            return '<thead class="tc-advanced-table-head"></thead>'
        }
        const loading = this.loading

        const cells = this._columns
            .map((col) => {
                const align: AdvancedTableAlign =
                    col.align && ALIGNS.includes(col.align) ? col.align : 'left'
                const styleParts: string[] = []
                if (col.width) styleParts.push(`width: ${esc(col.width)}`)
                styleParts.push(`text-align: ${align}`)
                const style = ` style="${styleParts.join('; ')}"`
                const label = `<span class="tc-advanced-table-th-label">${esc(col.label)}</span>`

                if (!this._sortableColumns.includes(col.key)) {
                    return `<th scope="col" class="tc-advanced-table-th tc-advanced-table-th--${align}"${style}>${label}</th>`
                }

                const active = !!this._sort && this._sort.column === col.key
                const ariaSort = active
                    ? this._sort!.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : 'none'
                const sortIcon = active
                    ? this._sort!.direction === 'asc'
                        ? chevronUpIcon
                        : chevronDownIcon
                    : chevronsUpDownIcon
                const disabledAttr = loading ? ' disabled' : ''
                return (
                    `<th scope="col" class="tc-advanced-table-th tc-advanced-table-th--${align}" aria-sort="${ariaSort}"${style}>` +
                    `<button type="button" class="tc-advanced-table-sort${active ? ' tc-advanced-table-sort--active' : ''}" ` +
                    `data-sort-key="${esc(col.key)}"${disabledAttr}>${label}${sortIcon}</button></th>`
                )
            })
            .join('')

        return `<thead class="tc-advanced-table-head"><tr>${cells}</tr></thead>`
    }

    private _renderOverlay(): string {
        return (
            `<div class="tc-advanced-table-overlay" role="status" aria-busy="true">` +
            `<span class="spinner-border tc-advanced-table-spinner" role="status">` +
            `<span class="visually-hidden">Loading…</span></span></div>`
        )
    }

    private _renderPagination(): string {
        const total = this.total
        if (total <= 0) return ''
        const limit = this.limit
        const offset = this.offset

        const start = Math.min(offset + 1, total)
        const end = Math.min(offset + limit, total)
        const pageCount = Math.max(1, Math.ceil(total / limit))
        const current = Math.min(Math.floor(offset / limit) + 1, pageCount)

        const summary = `<span class="tc-advanced-table-page-summary">${start}–${end} of ${total}</span>`
        // Reuse the canonical pager — its joined border / mono numerals / ink active
        // page are the shared pagination motif; we only feed it total + current and
        // listen for its tc-page-change (handled in _onPaginationPage).
        const pager =
            pageCount > 1
                ? `<tc-pagination size="sm" total="${pageCount}" current="${current}"></tc-pagination>`
                : ''

        return `<div class="tc-advanced-table-pagination">${summary}${pager}</div>`
    }

    private render(): void {
        const loading = this.loading
        if (loading) this.setAttribute('aria-busy', 'true')
        else this.removeAttribute('aria-busy')

        this.innerHTML =
            `<div class="tc-advanced-table${loading ? ' tc-advanced-table--loading' : ''}">` +
            this._renderToolbar() +
            `<div class="tc-advanced-table-body-wrap">` +
            `<table class="table tc-advanced-table-table">` +
            this._renderHead() +
            `<tbody class="tc-advanced-table-body"></tbody>` +
            `</table>` +
            (loading ? this._renderOverlay() : '') +
            `</div>` +
            this._renderPagination() +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AdvancedTable
    }
}
