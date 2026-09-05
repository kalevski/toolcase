import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { icon } from './icons'
import { msg } from './messages'
import { wireScrollEdges } from './internal/scroll-edges'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-static'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-table'

const chevronUpIcon = icon(ChevronUp, 'tc-table-sort-icon')
const chevronDownIcon = icon(ChevronDown, 'tc-table-sort-icon')
const chevronsUpDownIcon = icon(ChevronsUpDown, 'tc-table-sort-icon')

export type TableAlign = 'left' | 'center' | 'right'
const ALIGNS: TableAlign[] = ['left', 'center', 'right']

export type TableBreakpoint = 'sm' | 'md' | 'lg'
const BREAKPOINTS: TableBreakpoint[] = ['sm', 'md', 'lg']

export interface TableColumn {
    key: string
    header: string
    sortable?: boolean
    align?: TableAlign
    width?: string
    /** Hide this column below the given breakpoint (sm 576 / md 768 / lg 992).
     *  Identity + action columns should omit this so they survive every size. */
    hideBelow?: TableBreakpoint
    /** Minimum column width (any CSS length) — keeps the column readable and
     *  forces horizontal scrolling instead of mid-word clipping. */
    minWidth?: string
    render?: (row: any, index: number) => string
}

type SortDir = 'asc' | 'desc'

interface SortState {
    key: string
    dir: SortDir
}

// Stable comparator: numbers numerically, everything else as locale-aware
// strings with numeric collation. null/undefined sort first.
function compareValues(a: unknown, b: unknown): number {
    if (a == null && b == null) return 0
    if (a == null) return -1
    if (b == null) return 1
    if (typeof a === 'number' && typeof b === 'number') return a - b
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export class Table extends HTMLElement {
    private _initialised = false
    private _columns: TableColumn[] = []
    private _data: Record<string, unknown>[] = []
    private _rowKey: ((row: any, index: number) => string | number) | null = null
    private _sort: SortState | null = null

    // Optional callback mirror of the tc-row-click event. When set, rows become
    // interactive (clickable + keyboard-activatable) and dispatch tc-row-click.
    onrowclick: ((row: any, index: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'empty-message',
            'striped',
            'hoverable',
            'compact',
            'borderless',
            'sticky-header',
            'sticky-first-column',
            'sticky-last-column',
            'collapse',
            'collapse-below',
            'loading',
            'loading-rows',
        ]
    }

    private _unbindEdges: (() => void) | null = null

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        } else if (!this._unbindEdges) {
            // Re-wire after a disconnect/reconnect (React remount) — the DOM
            // survives but disconnectedCallback dropped the edge listeners.
            this._wireEdges()
        }
    }

    disconnectedCallback(): void {
        this._unbindEdges?.()
        this._unbindEdges = null
    }

    private _wireEdges(): void {
        const shell = this.querySelector<HTMLElement>('.tc-table-shell')
        const wrap = this.querySelector<HTMLElement>('.tc-table-wrap')
        this._unbindEdges = shell && wrap ? wireScrollEdges(shell, wrap) : null
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── JS properties ────────────────────────────────────────────────────────

    get columns(): TableColumn[] {
        return this._columns
    }
    set columns(v: TableColumn[]) {
        this._columns = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get data(): Record<string, unknown>[] {
        return this._data
    }
    set data(v: Record<string, unknown>[]) {
        this._data = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get rowKey(): ((row: any, index: number) => string | number) | null {
        return this._rowKey
    }
    set rowKey(v: ((row: any, index: number) => string | number) | null) {
        this._rowKey = typeof v === 'function' ? v : null
        if (this._initialised) this.render()
    }

    // ── Attributes ───────────────────────────────────────────────────────────

    get emptyMessage(): string {
        return this.getAttribute('empty-message') ?? msg('noData')
    }
    set emptyMessage(v: string) {
        setAttr(this, 'empty-message', v)
    }

    get striped(): boolean {
        return this.hasAttribute('striped')
    }
    set striped(v: boolean) {
        if (v) this.setAttribute('striped', '')
        else this.removeAttribute('striped')
    }

    get hoverable(): boolean {
        return this.hasAttribute('hoverable')
    }
    set hoverable(v: boolean) {
        if (v) this.setAttribute('hoverable', '')
        else this.removeAttribute('hoverable')
    }

    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        if (v) this.setAttribute('compact', '')
        else this.removeAttribute('compact')
    }

    get borderless(): boolean {
        return this.hasAttribute('borderless')
    }
    set borderless(v: boolean) {
        if (v) this.setAttribute('borderless', '')
        else this.removeAttribute('borderless')
    }

    get stickyHeader(): boolean {
        return this.hasAttribute('sticky-header')
    }
    set stickyHeader(v: boolean) {
        if (v) this.setAttribute('sticky-header', '')
        else this.removeAttribute('sticky-header')
    }

    /** Pin the first column (identity) while the body scrolls horizontally. */
    get stickyFirstColumn(): boolean {
        return this.hasAttribute('sticky-first-column')
    }
    set stickyFirstColumn(v: boolean) {
        if (v) this.setAttribute('sticky-first-column', '')
        else this.removeAttribute('sticky-first-column')
    }

    /** Pin the last column (row actions) while the body scrolls horizontally. */
    get stickyLastColumn(): boolean {
        return this.hasAttribute('sticky-last-column')
    }
    set stickyLastColumn(v: boolean) {
        if (v) this.setAttribute('sticky-last-column', '')
        else this.removeAttribute('sticky-last-column')
    }

    /** `collapse="card"`: below `collapse-below` each row renders as a stacked
     *  label/value card (labels from the column headers). */
    get collapse(): 'card' | null {
        return this.getAttribute('collapse') === 'card' ? 'card' : null
    }
    set collapse(v: 'card' | null) {
        if (v) this.setAttribute('collapse', v)
        else this.removeAttribute('collapse')
    }

    /** Breakpoint under which `collapse="card"` engages. Default `md` (768px). */
    get collapseBelow(): TableBreakpoint {
        const v = this.getAttribute('collapse-below') as TableBreakpoint
        return BREAKPOINTS.includes(v) ? v : 'md'
    }
    set collapseBelow(v: TableBreakpoint) {
        setAttr(this, 'collapse-below', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingRows(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-rows') ?? '5', 10) || 5)
    }
    set loadingRows(v: number) {
        this.setAttribute('loading-rows', String(v))
    }

    // ── Internals ────────────────────────────────────────────────────────────

    private _isInteractive(): boolean {
        return typeof this.onrowclick === 'function'
    }

    private _align(col: TableColumn): TableAlign {
        return col.align && ALIGNS.includes(col.align) ? col.align : 'left'
    }

    private _cycleSort(key: string): void {
        if (!this._sort || this._sort.key !== key) {
            this._sort = { key, dir: 'asc' }
        } else if (this._sort.dir === 'asc') {
            this._sort = { key, dir: 'desc' }
        } else {
            this._sort = null
        }
        this.render()
    }

    // Returns rows paired with their original index in `data`, sorted (stably)
    // by the active sort column. When no sort is active, original order.
    private _sortedRows(): Array<{ row: Record<string, unknown>; index: number }> {
        const rows = this._data.map((row, index) => ({ row, index }))
        const sort = this._sort
        if (!sort) return rows
        const dir = sort.dir === 'asc' ? 1 : -1
        return rows.sort((a, b) => {
            const cmp = compareValues(a.row[sort.key], b.row[sort.key])
            if (cmp !== 0) return cmp * dir
            return a.index - b.index
        })
    }

    private _ariaSortFor(col: TableColumn): string {
        if (!col.sortable) return ''
        if (this._sort && this._sort.key === col.key) {
            return this._sort.dir === 'asc' ? 'ascending' : 'descending'
        }
        return 'none'
    }

    private _sortIconFor(col: TableColumn): string {
        if (this._sort && this._sort.key === col.key) {
            return this._sort.dir === 'asc' ? chevronUpIcon : chevronDownIcon
        }
        return chevronsUpDownIcon
    }

    private _thStyle(col: TableColumn): string {
        const parts: string[] = []
        if (col.width) parts.push(`width: ${esc(col.width)}`)
        if (col.minWidth) parts.push(`min-width: ${esc(col.minWidth)}`)
        parts.push(`text-align: ${this._align(col)}`)
        return ` style="${parts.join('; ')}"`
    }

    private _hideClass(col: TableColumn): string {
        return col.hideBelow && BREAKPOINTS.includes(col.hideBelow)
            ? ` tc-col-hide-${col.hideBelow}`
            : ''
    }

    private render(): void {
        const cols = this._columns
        const colCount = Math.max(1, cols.length)
        const loading = this.loading
        const interactive = this._isInteractive()

        this.classList.add('tc-table-host')
        if (loading) this.setAttribute('aria-busy', 'true')
        else this.removeAttribute('aria-busy')

        // ── Header ──
        const theadCells = cols
            .map((col) => {
                const align = this._align(col)
                const ariaSort = this._ariaSortFor(col)
                const ariaSortAttr = ariaSort ? ` aria-sort="${ariaSort}"` : ''
                const inner = col.sortable
                    ? `<button type="button" class="tc-table-sort" data-sort-key="${esc(col.key)}">` +
                      `<span class="tc-table-th-label">${esc(col.header)}</span>` +
                      this._sortIconFor(col) +
                      `</button>`
                    : `<span class="tc-table-th-label">${esc(col.header)}</span>`
                return `<th scope="col" class="tc-table-th tc-table-th--${align}${this._hideClass(col)}"${ariaSortAttr}${this._thStyle(col)}>${inner}</th>`
            })
            .join('')

        // ── Body ──
        let tbodyRows: string
        if (loading) {
            const rowCells = cols
                .map(() => `<td class="tc-table-td"><tc-skeleton></tc-skeleton></td>`)
                .join('')
            const skeletonRow = `<tr class="tc-table-row tc-table-row--skeleton" aria-hidden="true">${rowCells}</tr>`
            tbodyRows = Array.from({ length: this.loadingRows }, () => skeletonRow).join('')
        } else if (this._data.length === 0) {
            // The empty message renders through the canonical tc-empty-state (the
            // custom element upgrades inside the injected cell), so every table
            // shares one empty treatment.
            tbodyRows =
                `<tr class="tc-table-row"><td class="tc-table-empty" colspan="${colCount}">` +
                `<tc-empty-state icon="inbox">${esc(this.emptyMessage)}</tc-empty-state></td></tr>`
        } else {
            tbodyRows = this._sortedRows()
                .map(({ row, index }) => {
                    const keyVal = this._rowKey ? this._rowKey(row, index) : index
                    const rowCls = `tc-table-row${interactive ? ' tc-table-row--clickable' : ''}`
                    const rowAttrs = interactive ? ` tabindex="0" data-idx="${index}"` : ''
                    const cells = cols
                        .map((col) => {
                            const align = this._align(col)
                            const styleParts: string[] = []
                            if (col.width) styleParts.push(`width: ${esc(col.width)}`)
                            if (col.minWidth) styleParts.push(`min-width: ${esc(col.minWidth)}`)
                            styleParts.push(`text-align: ${align}`)
                            const cellHtml =
                                typeof col.render === 'function'
                                    ? col.render(row, index)
                                    : esc(String(row[col.key] ?? ''))
                            // data-label feeds the collapse="card" ::before labels.
                            return `<td class="tc-table-td tc-table-td--${align}${this._hideClass(col)}" data-label="${esc(col.header)}" style="${styleParts.join('; ')}">${cellHtml}</td>`
                        })
                        .join('')
                    return `<tr class="${rowCls}" data-key="${esc(String(keyVal))}"${rowAttrs}>${cells}</tr>`
                })
                .join('')
        }

        const tableCls = [
            'table',
            'tc-table',
            this.striped ? 'table-striped' : '',
            this.hoverable ? 'table-hover' : '',
            this.compact ? 'table-sm' : '',
            this.borderless ? 'table-borderless' : '',
        ]
            .filter(Boolean)
            .join(' ')

        const wrapCls = [
            'tc-table-wrap',
            this.stickyHeader ? 'tc-table-wrap--sticky' : '',
            this.stickyFirstColumn ? 'tc-table-wrap--sticky-first' : '',
            this.stickyLastColumn ? 'tc-table-wrap--sticky-last' : '',
            this.collapse === 'card' ? `tc-table-wrap--card-${this.collapseBelow}` : '',
        ]
            .filter(Boolean)
            .join(' ')

        this._unbindEdges?.()
        patchHtml(
            this,
            `<div class="tc-table-shell tc-scroll-shadow">` +
                `<div class="${wrapCls}">` +
                `<table class="${tableCls}">` +
                `<thead class="tc-table-head"><tr>${theadCells}</tr></thead>` +
                `<tbody class="tc-table-body">${tbodyRows}</tbody>` +
                `</table>` +
                `</div>` +
                `</div>`,
        )

        this._wireEdges()

        this._wireEvents()
    }

    private _wireEvents(): void {
        const thead = this.querySelector<HTMLElement>('.tc-table-head')
        if (thead) {
            bindOnce(thead, 'click', (e: Event) => {
                const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sort-key]')
                if (!btn) return
                const key = btn.dataset.sortKey
                if (key) this._cycleSort(key)
            })
        }

        if (!this._isInteractive()) return
        const tbody = this.querySelector<HTMLElement>('.tc-table-body')
        if (!tbody) return

        const activate = (target: HTMLElement): void => {
            const tr = target.closest<HTMLElement>('tr[data-idx]')
            if (!tr) return
            const idx = parseInt(tr.dataset.idx ?? '-1', 10)
            const row = this._data[idx]
            if (row === undefined) return
            this.dispatchEvent(
                new CustomEvent('tc-row-click', {
                    bubbles: true,
                    composed: true,
                    detail: { row, index: idx },
                }),
            )
            if (typeof this.onrowclick === 'function') this.onrowclick(row, idx)
        }

        bindOnce(tbody, 'click', (e: Event) => activate(e.target as HTMLElement))
        bindOnce(tbody, 'keydown', (e: Event) => {
            const ke = e as KeyboardEvent
            if (ke.key !== 'Enter' && ke.key !== ' ') return
            ke.preventDefault()
            activate(ke.target as HTMLElement)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Table
    }
}
