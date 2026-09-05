import { bindOnce, patchHtml } from './internal/patch-html'
const TAG_NAME = 'tc-virtual-list'

const DEFAULT_HEIGHT = 320
const DEFAULT_ITEM_HEIGHT = 40
const DEFAULT_OVERSCAN = 3
const DEFAULT_END_THRESHOLD = 200

export type VirtualListItemHeight = number | ((index: number) => number)
export type VirtualListRenderItem = (item: any, index: number) => string | Node

/**
 * tc-virtual-list — framework-free virtualized list. Only the rows inside the
 * scroll window (plus an overscan margin) are kept in the DOM; a full-height
 * sizer reproduces the scrollbar geometry and the window is positioned with a
 * single `translateY`. Variable row heights are supported via a cumulative
 * offset table built once per `items`/`itemHeight` change. Scroll metrics are
 * read at most once per animation frame to avoid layout thrash.
 */
export class VirtualList extends HTMLElement {
    private _initialised = false

    private _items: any[] = []
    private _itemHeight: VirtualListItemHeight = DEFAULT_ITEM_HEIGHT
    private _renderItem: VirtualListRenderItem | null = null

    // Cumulative offset table — only populated when itemHeight is a function.
    // _offsets[i] is the top px of item i; _offsets[n] is the total height.
    private _offsets: number[] | null = null
    private _totalHeight = 0

    private _viewport: HTMLElement | null = null
    private _resizeObserver: ResizeObserver | null = null
    private _rafPending = false

    // Last rendered window range — used to skip rebuilding identical windows.
    private _lastFirst = -1
    private _lastLast = -1

    // Guard so tc-end-reached fires once per crossing (resets when scrolled up).
    private _endFired = false

    /** Optional callback fired alongside the `tc-end-reached` event. */
    onEndReached: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['height', 'overscan', 'end-reached-threshold']
    }

    connectedCallback(): void {
        if (!this._resizeObserver && typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._scheduleUpdate())
        }
        if (!this._initialised) {
            this.render()
            this._initialised = true
        } else {
            // Re-attach after a disconnect/reconnect cycle.
            this.render()
        }
    }

    disconnectedCallback(): void {
        this._detachViewport()
        this._resizeObserver?.disconnect()
        this._resizeObserver = null
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'height') {
            // Viewport height lives on the structural element — rebuild it.
            this.render()
            return
        }
        // overscan / end-reached-threshold only affect the window computation.
        this._lastFirst = -1
        this._lastLast = -1
        this._updateWindow()
    }

    // ── Attributes ───────────────────────────────────────────────────────────

    get height(): number {
        const raw = parseInt(this.getAttribute('height') ?? '', 10)
        return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_HEIGHT
    }
    set height(v: number) {
        this.setAttribute('height', String(v))
    }

    get overscan(): number {
        const raw = parseInt(this.getAttribute('overscan') ?? '', 10)
        return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_OVERSCAN
    }
    set overscan(v: number) {
        this.setAttribute('overscan', String(v))
    }

    get endReachedThreshold(): number {
        const raw = parseInt(this.getAttribute('end-reached-threshold') ?? '', 10)
        return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_END_THRESHOLD
    }
    set endReachedThreshold(v: number) {
        this.setAttribute('end-reached-threshold', String(v))
    }

    // ── JS properties ────────────────────────────────────────────────────────

    get items(): any[] {
        return this._items
    }
    set items(v: any[]) {
        this._items = Array.isArray(v) ? v : []
        this._refresh()
    }

    get itemHeight(): VirtualListItemHeight {
        return this._itemHeight
    }
    set itemHeight(v: VirtualListItemHeight) {
        if (typeof v === 'function') this._itemHeight = v
        else this._itemHeight = Number.isFinite(v) && (v as number) > 0 ? v : DEFAULT_ITEM_HEIGHT
        this._refresh()
    }

    get renderItem(): VirtualListRenderItem | null {
        return this._renderItem
    }
    set renderItem(v: VirtualListRenderItem | null) {
        this._renderItem = typeof v === 'function' ? v : null
        this._lastFirst = -1
        this._lastLast = -1
        this._updateWindow()
    }

    // ── Height geometry ──────────────────────────────────────────────────────

    private _fixedHeight(): number {
        const h = this._itemHeight as number
        return Number.isFinite(h) && h > 0 ? h : DEFAULT_ITEM_HEIGHT
    }

    /** Rebuild the offset table / total height for the current items + heights. */
    private _recompute(): void {
        const n = this._items.length
        if (typeof this._itemHeight === 'function') {
            const fn = this._itemHeight
            const offsets = new Array<number>(n + 1)
            offsets[0] = 0
            for (let i = 0; i < n; i++) {
                const h = Number(fn(i))
                offsets[i + 1] = offsets[i] + (Number.isFinite(h) && h > 0 ? h : 0)
            }
            this._offsets = offsets
            this._totalHeight = offsets[n]
        } else {
            this._offsets = null
            this._totalHeight = n * this._fixedHeight()
        }
    }

    private _offsetForIndex(i: number): number {
        if (this._offsets) return this._offsets[i] ?? 0
        return i * this._fixedHeight()
    }

    private _rowHeight(i: number): number {
        if (this._offsets) return (this._offsets[i + 1] ?? this._offsets[i]) - this._offsets[i]
        return this._fixedHeight()
    }

    /** First index whose row contains vertical offset `y`. */
    private _indexAtOffset(y: number): number {
        const n = this._items.length
        if (n === 0) return 0
        const clamped = Math.max(0, Math.min(y, this._totalHeight - 1))
        if (!this._offsets) {
            return Math.max(0, Math.min(Math.floor(clamped / this._fixedHeight()), n - 1))
        }
        // Largest i with offsets[i] <= clamped (binary search).
        let lo = 0
        let hi = n - 1
        const offsets = this._offsets
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1
            if (offsets[mid] <= clamped) lo = mid
            else hi = mid - 1
        }
        return lo
    }

    // ── Listener / observer wiring ───────────────────────────────────────────

    private _onScroll = (): void => {
        this._scheduleUpdate()
    }

    private _scheduleUpdate(): void {
        if (this._rafPending) return
        this._rafPending = true
        requestAnimationFrame(() => {
            this._rafPending = false
            this._updateWindow()
        })
    }

    private _detachViewport(): void {
        if (this._viewport) {
            this._viewport.removeEventListener('scroll', this._onScroll)
            this._resizeObserver?.unobserve(this._viewport)
        }
        this._viewport = null
    }

    // ── Window rendering ─────────────────────────────────────────────────────

    private _refresh(): void {
        if (!this._initialised || !this.isConnected) return
        this._recompute()
        this._lastFirst = -1
        this._lastLast = -1
        this._updateWindow()
    }

    private _buildRow(i: number, n: number): HTMLElement {
        const row = document.createElement('div')
        row.className = 'tc-virtual-list-item'
        row.setAttribute('role', 'listitem')
        row.setAttribute('aria-setsize', String(n))
        row.setAttribute('aria-posinset', String(i + 1))
        row.style.height = `${this._rowHeight(i)}px`
        const out = this._renderItem ? this._renderItem(this._items[i], i) : ''
        if (out instanceof Node) row.appendChild(out)
        else row.innerHTML = String(out)
        return row
    }

    private _updateWindow(): void {
        const viewport = this._viewport
        const sizer = viewport?.querySelector<HTMLElement>('.tc-virtual-list-sizer')
        const win = viewport?.querySelector<HTMLElement>('.tc-virtual-list-window')
        if (!viewport || !sizer || !win) return

        const n = this._items.length
        sizer.style.height = `${this._totalHeight}px`

        const scrollTop = viewport.scrollTop
        const clientHeight = viewport.clientHeight
        const overscan = this.overscan

        let first = 0
        let last = -1
        if (n > 0) {
            first = Math.max(0, this._indexAtOffset(scrollTop) - overscan)
            last = Math.min(n - 1, this._indexAtOffset(scrollTop + clientHeight) + overscan)
        }

        // Position the window at the first visible row's offset.
        win.style.transform = `translateY(${n > 0 ? this._offsetForIndex(first) : 0}px)`

        // Skip the (expensive) rebuild when the visible range is unchanged.
        if (first !== this._lastFirst || last !== this._lastLast) {
            this._lastFirst = first
            this._lastLast = last
            const frag = document.createDocumentFragment()
            for (let i = first; i <= last; i++) frag.appendChild(this._buildRow(i, n))
            win.innerHTML = ''
            win.appendChild(frag)
        }

        this._checkEndReached(viewport)
    }

    private _checkEndReached(viewport: HTMLElement): void {
        const threshold = this.endReachedThreshold
        const atEnd =
            viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - threshold
        if (atEnd && this._items.length > 0) {
            if (!this._endFired) {
                this._endFired = true
                this.dispatchEvent(
                    new CustomEvent('tc-end-reached', {
                        bubbles: true,
                        composed: true,
                        detail: {},
                    }),
                )
                if (typeof this.onEndReached === 'function') this.onEndReached()
            }
        } else {
            this._endFired = false
        }
    }

    private render(): void {
        this._detachViewport()

        patchHtml(
            this,
            `<div class="tc-virtual-list" role="list" tabindex="0" style="height:${this.height}px">` +
                `<div class="tc-virtual-list-sizer">` +
                `<div class="tc-virtual-list-window"></div>` +
                `</div>` +
                `</div>`,
        )

        const viewport = this.querySelector<HTMLElement>('.tc-virtual-list')
        if (viewport) {
            this._viewport = viewport
            bindOnce(viewport, 'scroll', this._onScroll, { passive: true })
            this._resizeObserver?.observe(viewport)
        }

        // Force a full window rebuild against the fresh structure.
        this._lastFirst = -1
        this._lastLast = -1
        this._recompute()
        this._updateWindow()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VirtualList
    }
}
