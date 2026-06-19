import { esc } from './internal/esc'
import { icon } from './icons'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-static'

const TAG_NAME = 'tc-table'

const chevronUpIcon = icon(ChevronUp, 'tc-table-sort-icon')
const chevronDownIcon = icon(ChevronDown, 'tc-table-sort-icon')
const chevronsUpDownIcon = icon(ChevronsUpDown, 'tc-table-sort-icon')

export type TableAlign = 'left' | 'center' | 'right'
const ALIGNS: TableAlign[] = ['left', 'center', 'right']

export interface TableColumn {
    key: string
    header: string
    sortable?: boolean
    align?: TableAlign
    width?: string
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
            'loading',
            'loading-rows',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
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
        return this.getAttribute('empty-message') ?? 'No data'
    }
    set emptyMessage(v: string) {
        this.setAttribute('empty-message', v)
    }

    get striped(): boolean {
        return this.hasAttribute('striped')
    }
    set striped(v: boolean) {
        v ? this.setAttribute('striped', '') : this.removeAttribute('striped')
    }

    get hoverable(): boolean {
        return this.hasAttribute('hoverable')
    }
    set hoverable(v: boolean) {
        v ? this.setAttribute('hoverable', '') : this.removeAttribute('hoverable')
    }

    get compact(): boolean {
        return this.hasAttribute('compact')
    }
    set compact(v: boolean) {
        v ? this.setAttribute('compact', '') : this.removeAttribute('compact')
    }

    get borderless(): boolean {
        return this.hasAttribute('borderless')
    }
    set borderless(v: boolean) {
        v ? this.setAttribute('borderless', '') : this.removeAttribute('borderless')
    }

    get stickyHeader(): boolean {
        return this.hasAttribute('sticky-header')
    }
    set stickyHeader(v: boolean) {
        v ? this.setAttribute('sticky-header', '') : this.removeAttribute('sticky-header')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        v ? this.setAttribute('loading', '') : this.removeAttribute('loading')
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
        parts.push(`text-align: ${this._align(col)}`)
        return ` style="${parts.join('; ')}"`
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
                return `<th scope="col" class="tc-table-th tc-table-th--${align}"${ariaSortAttr}${this._thStyle(col)}>${inner}</th>`
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
            tbodyRows =
                `<tr class="tc-table-row"><td class="tc-table-empty" colspan="${colCount}">` +
                `${esc(this.emptyMessage)}</td></tr>`
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
                            styleParts.push(`text-align: ${align}`)
                            const cellHtml =
                                typeof col.render === 'function'
                                    ? col.render(row, index)
                                    : esc(String(row[col.key] ?? ''))
                            return `<td class="tc-table-td tc-table-td--${align}" style="${styleParts.join('; ')}">${cellHtml}</td>`
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

        const wrapCls = `tc-table-wrap${this.stickyHeader ? ' tc-table-wrap--sticky' : ''}`

        this.innerHTML =
            `<div class="${wrapCls}">` +
            `<table class="${tableCls}">` +
            `<thead class="tc-table-head"><tr>${theadCells}</tr></thead>` +
            `<tbody class="tc-table-body">${tbodyRows}</tbody>` +
            `</table>` +
            `</div>`

        this._wireEvents()
    }

    private _wireEvents(): void {
        const thead = this.querySelector<HTMLElement>('.tc-table-head')
        if (thead) {
            thead.addEventListener('click', (e: Event) => {
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

        tbody.addEventListener('click', (e: Event) => activate(e.target as HTMLElement))
        tbody.addEventListener('keydown', (e: Event) => {
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
