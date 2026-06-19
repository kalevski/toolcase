const TAG_NAME = 'tc-resizable-panel'

export type ResizablePanelDirection = 'horizontal' | 'vertical'

const DIRECTIONS: ResizablePanelDirection[] = ['horizontal', 'vertical']

// Read persisted sizes from localStorage, falling back to defaultSizes.
function readSizes(storageKey: string | null, defaultSizes: [number, number]): [number, number] {
    if (!storageKey) return defaultSizes
    try {
        const raw = localStorage.getItem(storageKey)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (
                Array.isArray(parsed) &&
                parsed.length === 2 &&
                typeof parsed[0] === 'number' &&
                typeof parsed[1] === 'number'
            ) {
                return [parsed[0], parsed[1]]
            }
        }
    } catch {
        // ignore malformed/unavailable storage
    }
    return defaultSizes
}

export class ResizablePanel extends HTMLElement {
    private _initialised = false
    private _sizes: [number, number] = [50, 50]
    private _defaultSizes: [number, number] = [50, 50]

    private _dragging = false
    private _startPos = 0
    private _startA = 50
    private _dragMoveHandler: ((e: PointerEvent) => void) | null = null
    private _dragUpHandler: (() => void) | null = null

    onResize: ((sizes: [number, number]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['direction', 'min-size', 'storage-key']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // The first two element children become pane A and pane B.
            const kids = Array.from(this.children)
            this._sizes = this._clamp(readSizes(this.storageKey, this._defaultSizes)[0])
            this.render()
            const paneA = this.querySelector('.tc-resizable-panel-pane--first')
            const paneB = this.querySelector('.tc-resizable-panel-pane--second')
            if (paneA && kids[0]) paneA.appendChild(kids[0])
            if (paneB && kids[1]) paneB.appendChild(kids[1])
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._cleanupDrag()
    }

    attributeChangedCallback(name: string, _old: string | null, _next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'storage-key') {
            // Re-read persisted sizes for the new key (or fall back to defaults).
            this._sizes = this._clamp(readSizes(this.storageKey, this._defaultSizes)[0])
        } else {
            // Re-clamp under a possibly-changed min-size.
            this._sizes = this._clamp(this._sizes[0])
        }
        this._rerenderWithPanes()
    }

    // ── Props ───────────────────────────────────────────────────────────────────

    get direction(): ResizablePanelDirection {
        const v = this.getAttribute('direction') as ResizablePanelDirection
        return DIRECTIONS.includes(v) ? v : 'horizontal'
    }
    set direction(v: ResizablePanelDirection) {
        this.setAttribute('direction', v)
    }

    get minSize(): number {
        const raw = parseFloat(this.getAttribute('min-size') ?? '10')
        if (isNaN(raw)) return 10
        return Math.min(Math.max(raw, 0), 49)
    }
    set minSize(v: number) {
        this.setAttribute('min-size', String(v))
    }

    get storageKey(): string | null {
        return this.getAttribute('storage-key')
    }
    set storageKey(v: string | null) {
        if (v != null) this.setAttribute('storage-key', v)
        else this.removeAttribute('storage-key')
    }

    get defaultSizes(): [number, number] {
        return [...this._defaultSizes] as [number, number]
    }
    set defaultSizes(v: [number, number]) {
        if (
            !Array.isArray(v) ||
            v.length < 2 ||
            typeof v[0] !== 'number' ||
            typeof v[1] !== 'number'
        )
            return
        this._defaultSizes = [v[0], v[1]]
        if (this._initialised) {
            this._sizes = this._clamp(readSizes(this.storageKey, this._defaultSizes)[0])
            this._patchSizes()
        }
    }

    get sizes(): [number, number] {
        return [...this._sizes] as [number, number]
    }
    set sizes(v: [number, number]) {
        if (!Array.isArray(v) || v.length < 2) return
        this._sizes = this._clamp(v[0])
        if (this._initialised) this._patchSizes()
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    private _clamp(a: number): [number, number] {
        const min = this.minSize
        const clampedA = Math.min(Math.max(a, min), 100 - min)
        return [clampedA, 100 - clampedA]
    }

    private _isHorizontal(): boolean {
        return this.direction === 'horizontal'
    }

    private _persist(): void {
        const key = this.storageKey
        if (!key) return
        try {
            localStorage.setItem(key, JSON.stringify(this._sizes))
        } catch {
            // ignore unavailable storage
        }
    }

    private _patchSizes(): void {
        const [a, b] = this._sizes
        const paneA = this.querySelector<HTMLElement>('.tc-resizable-panel-pane--first')
        const paneB = this.querySelector<HTMLElement>('.tc-resizable-panel-pane--second')
        const divider = this.querySelector('.tc-resizable-panel-divider')
        if (paneA) paneA.style.flexBasis = `${a}%`
        if (paneB) paneB.style.flexBasis = `${b}%`
        if (divider) divider.setAttribute('aria-valuenow', String(Math.round(a)))
    }

    private _commit(next: [number, number]): void {
        this._sizes = next
        this._patchSizes()
        this._persist()
        this._fireResize()
    }

    private _fireResize(): void {
        const sizes: [number, number] = [...this._sizes] as [number, number]
        this.dispatchEvent(
            new CustomEvent('tc-resize', {
                bubbles: true,
                composed: true,
                detail: { sizes },
            }),
        )
        if (typeof this.onResize === 'function') this.onResize(sizes)
    }

    // ── Pointer drag ────────────────────────────────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        const target = e.target as Element
        if (!target.closest('.tc-resizable-panel-divider')) return
        e.preventDefault()
        this._dragging = true
        this._startPos = this._isHorizontal() ? e.clientX : e.clientY
        this._startA = this._sizes[0]
        this.classList.add('tc-resizable-panel--dragging')
        this._startDrag()
    }

    private _startDrag(): void {
        this._dragMoveHandler = (e: PointerEvent) => {
            if (!this._dragging) return
            const container = this.querySelector('.tc-resizable-panel')
            if (!container) return
            const rect = container.getBoundingClientRect()
            const total = this._isHorizontal() ? rect.width : rect.height
            if (total === 0) return
            const pos = this._isHorizontal() ? e.clientX : e.clientY
            const deltaPct = ((pos - this._startPos) / total) * 100
            this._sizes = this._clamp(this._startA + deltaPct)
            this._patchSizes()
        }
        this._dragUpHandler = () => {
            this.classList.remove('tc-resizable-panel--dragging')
            this._persist()
            this._fireResize()
            this._cleanupDrag()
        }
        document.addEventListener('pointermove', this._dragMoveHandler)
        document.addEventListener('pointerup', this._dragUpHandler)
        document.addEventListener('pointercancel', this._dragUpHandler)
    }

    private _cleanupDrag(): void {
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler)
            this._dragMoveHandler = null
        }
        if (this._dragUpHandler) {
            document.removeEventListener('pointerup', this._dragUpHandler)
            document.removeEventListener('pointercancel', this._dragUpHandler)
            this._dragUpHandler = null
        }
        this._dragging = false
    }

    // ── Keyboard ────────────────────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        const target = e.target as Element
        if (!target.closest('.tc-resizable-panel-divider')) return

        const horizontal = this._isHorizontal()
        const min = this.minSize
        const max = 100 - min
        const step = 5
        let a = this._sizes[0]
        let changed = false

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                if (horizontal && e.key === 'ArrowDown') break
                if (!horizontal && e.key === 'ArrowRight') break
                e.preventDefault()
                a = Math.min(max, a + step)
                changed = true
                break
            case 'ArrowLeft':
            case 'ArrowUp':
                if (horizontal && e.key === 'ArrowUp') break
                if (!horizontal && e.key === 'ArrowLeft') break
                e.preventDefault()
                a = Math.max(min, a - step)
                changed = true
                break
            case 'Home':
                e.preventDefault()
                a = min
                changed = true
                break
            case 'End':
                e.preventDefault()
                a = max
                changed = true
                break
        }

        if (changed) this._commit(this._clamp(a))
    }

    // ── Double-click reset ──────────────────────────────────────────────────────

    private _onDblClick = (e: MouseEvent): void => {
        const target = e.target as Element
        if (!target.closest('.tc-resizable-panel-divider')) return
        e.preventDefault()
        this._commit(this._clamp(this._defaultSizes[0]))
    }

    // ── Window resize ───────────────────────────────────────────────────────────

    private _onResizeWindow = (): void => {
        // Percentages keep proportions intact; just re-clamp under current min-size.
        this._sizes = this._clamp(this._sizes[0])
        this._patchSizes()
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('keydown', this._onKeyDown)
        this.addEventListener('dblclick', this._onDblClick)
        window.addEventListener('resize', this._onResizeWindow, { passive: true })
    }

    private _detachHandlers(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('keydown', this._onKeyDown)
        this.removeEventListener('dblclick', this._onDblClick)
        window.removeEventListener('resize', this._onResizeWindow)
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    private _rerenderWithPanes(): void {
        const paneAEl = this.querySelector('.tc-resizable-panel-pane--first')
        const paneBEl = this.querySelector('.tc-resizable-panel-pane--second')
        const aNodes = paneAEl ? Array.from(paneAEl.childNodes) : []
        const bNodes = paneBEl ? Array.from(paneBEl.childNodes) : []
        this.render()
        const newA = this.querySelector('.tc-resizable-panel-pane--first')
        const newB = this.querySelector('.tc-resizable-panel-pane--second')
        if (newA) aNodes.forEach((n) => newA.appendChild(n))
        if (newB) bNodes.forEach((n) => newB.appendChild(n))
    }

    private render(): void {
        const direction = this.direction
        const horizontal = direction === 'horizontal'
        const [a, b] = this._sizes
        const min = this.minSize

        this.innerHTML = [
            `<div class="tc-resizable-panel tc-resizable-panel--${direction}">`,
            `<div class="tc-resizable-panel-pane tc-resizable-panel-pane--first" style="flex-basis:${a}%"></div>`,
            `<div class="tc-resizable-panel-divider"`,
            ` role="separator"`,
            ` aria-orientation="${horizontal ? 'vertical' : 'horizontal'}"`,
            ` aria-valuemin="${Math.round(min)}"`,
            ` aria-valuemax="${Math.round(100 - min)}"`,
            ` aria-valuenow="${Math.round(a)}"`,
            ` aria-label="Resize panels. Double-click to reset."`,
            ` tabindex="0"`,
            `>`,
            `<span class="tc-resizable-panel-grip" aria-hidden="true"></span>`,
            `</div>`,
            `<div class="tc-resizable-panel-pane tc-resizable-panel-pane--second" style="flex-basis:${b}%"></div>`,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ResizablePanel
    }
}
