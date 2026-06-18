const TAG_NAME = 'tc-pause-screen'

let _idCounter = 0

export interface PauseScreenItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

const DEFAULT_ITEMS: PauseScreenItem[] = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'quit', label: 'Quit' },
]

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter(el => !el.closest('[hidden]') && el.tabIndex >= 0)
}

export class PauseScreen extends HTMLElement {
    private _initialised = false
    private _items: PauseScreenItem[] = DEFAULT_ITEMS.slice()
    private _previousFocus: Element | null = null
    private _idPrefix: string

    onResume: (() => void) | null = null
    onRestart: (() => void) | null = null
    onQuit: (() => void) | null = null
    onClose: (() => void) | null = null
    onSelect: ((id: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-pause-screen-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'screen-title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._applyOpenState(true)
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._restoreScroll()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            this._applyOpenState(this.open)
            return
        }

        this.render()
        if (this.open) this._applyOpenState(true)
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get screenTitle(): string {
        return this.getAttribute('screen-title') ?? 'Paused'
    }
    set screenTitle(v: string) {
        if (v) this.setAttribute('screen-title', v)
        else this.removeAttribute('screen-title')
    }

    get items(): PauseScreenItem[] {
        return this._items.slice()
    }
    set items(value: PauseScreenItem[]) {
        this._items = Array.isArray(value) && value.length ? value.slice() : DEFAULT_ITEMS.slice()
        if (this._initialised) this._syncItems()
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private _buildItemsHtml(): string {
        return this._items.map(item => {
            const cls = [
                'tc-pause-screen__item',
                item.disabled ? 'tc-pause-screen__item--disabled' : '',
            ].filter(Boolean).join(' ')
            const badgeHtml = item.badge
                ? `<span class="tc-pause-screen__item-badge">${esc(item.badge)}</span>`
                : ''
            return (
                `<div role="menuitem"` +
                ` class="${cls}"` +
                ` data-id="${esc(item.id)}"` +
                ` tabindex="${item.disabled ? '-1' : '0'}"` +
                (item.disabled ? ` aria-disabled="true"` : '') +
                `>` +
                `<span class="tc-pause-screen__item-label">${esc(item.label)}</span>` +
                badgeHtml +
                `</div>`
            )
        }).join('')
    }

    private _syncItems(): void {
        const list = this.querySelector('.tc-pause-screen__items')
        if (list) list.innerHTML = this._buildItemsHtml()
    }

    private _fireSelect(id: string): void {
        this.dispatchEvent(new CustomEvent('tc-select', {
            bubbles: true,
            composed: true,
            detail: { id },
        }))
        if (typeof this.onSelect === 'function') this.onSelect(id)

        if (id === 'resume') {
            this.dispatchEvent(new CustomEvent('tc-resume', { bubbles: true, composed: true, detail: {} }))
            if (typeof this.onResume === 'function') this.onResume()
        } else if (id === 'restart') {
            this.dispatchEvent(new CustomEvent('tc-restart', { bubbles: true, composed: true, detail: {} }))
            if (typeof this.onRestart === 'function') this.onRestart()
        } else if (id === 'quit') {
            this.dispatchEvent(new CustomEvent('tc-quit', { bubbles: true, composed: true, detail: {} }))
            if (typeof this.onQuit === 'function') this.onQuit()
        }
    }

    // ── Open / close lifecycle ──────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        const panel = this.querySelector<HTMLElement>('.tc-pause-screen__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-pause-screen__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            requestAnimationFrame(() => {
                this.classList.add('tc-pause-screen--open')
                panel?.setAttribute('aria-hidden', 'false')
                this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this.classList.remove('tc-pause-screen--open')
            panel?.setAttribute('aria-hidden', 'true')
            this._restoreScroll()
            this._restoreFocus()
            const delay = this._getTransitionDuration(panel)
            setTimeout(() => {
                if (!this.open) {
                    panel?.setAttribute('hidden', '')
                    backdrop?.setAttribute('hidden', '')
                }
            }, delay)
        }
    }

    private _requestClose(): void {
        this.dispatchEvent(new CustomEvent('tc-close', {
            bubbles: true,
            composed: true,
            detail: {},
        }))
        if (typeof this.onClose === 'function') this.onClose()
    }

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        const focusable = getFocusable(panel)
        if (focusable.length > 0) focusable[0].focus()
        else panel.focus()
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) this._previousFocus.focus()
        this._previousFocus = null
    }

    private _lockScroll(): void {
        document.body.style.overflow = 'hidden'
    }

    private _restoreScroll(): void {
        document.body.style.overflow = ''
    }

    private _getTransitionDuration(el: HTMLElement | null): number {
        if (!el) return 0
        const raw = getComputedStyle(el).transitionDuration || '0s'
        let max = 0
        for (const p of raw.split(',')) {
            const sec = parseFloat(p.trim())
            if (!isNaN(sec)) max = Math.max(max, sec)
        }
        return max * 1000
    }

    // ── Event handlers ──────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return

        if (e.key === 'Escape') {
            e.preventDefault()
            this._requestClose()
            return
        }

        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>('.tc-pause-screen__panel')
            if (!panel) return
            const focusable = getFocusable(panel)
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
            return
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const items = Array.from(
                this.querySelectorAll<HTMLElement>('.tc-pause-screen__item:not(.tc-pause-screen__item--disabled)'),
            )
            if (items.length === 0) return
            e.preventDefault()
            const current = items.indexOf(document.activeElement as HTMLElement)
            const next = e.key === 'ArrowDown'
                ? (current + 1) % items.length
                : (current - 1 + items.length) % items.length
            items[next].focus()
            return
        }

        if (e.key === 'Enter' || e.key === ' ') {
            const item = (document.activeElement as Element | null)
                ?.closest<HTMLElement>('.tc-pause-screen__item')
            if (item && this.contains(item) && !item.classList.contains('tc-pause-screen__item--disabled')) {
                e.preventDefault()
                const id = item.dataset.id
                if (id) this._fireSelect(id)
            }
        }
    }

    private _onBackdropClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.classList.contains('tc-pause-screen__backdrop')) {
            this._requestClose()
        }
    }

    private _onItemClick = (e: MouseEvent): void => {
        const item = (e.target as Element)?.closest<HTMLElement>('.tc-pause-screen__item')
        if (!item || !this.contains(item)) return
        if (item.classList.contains('tc-pause-screen__item--disabled')) return
        const id = item.dataset.id
        if (id) this._fireSelect(id)
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onBackdropClick)
        this.addEventListener('click', this._onItemClick)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onBackdropClick)
        this.removeEventListener('click', this._onItemClick)
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    private render(): void {
        const isOpen = this.open
        const labelId = `${this._idPrefix}-title`
        const hiddenAttr = isOpen ? '' : ' hidden'
        const titleText = this.getAttribute('screen-title') ?? 'Paused'

        this.innerHTML =
            `<div class="tc-pause-screen__backdrop" aria-hidden="true"${hiddenAttr}></div>` +
            `<div class="tc-pause-screen__panel" role="dialog" aria-modal="true"` +
            ` aria-labelledby="${labelId}" tabindex="-1"` +
            ` aria-hidden="${isOpen ? 'false' : 'true'}"${hiddenAttr}>` +
            `<div class="tc-pause-screen__header">` +
            `<span class="tc-pause-screen__eyebrow">Game Paused</span>` +
            `<h2 class="tc-pause-screen__title" id="${labelId}">${esc(titleText)}</h2>` +
            `</div>` +
            `<div class="tc-pause-screen__items" role="menu" aria-label="${esc(titleText)}">` +
            this._buildItemsHtml() +
            `</div>` +
            `</div>`

        if (isOpen) this.classList.add('tc-pause-screen--open')
        else this.classList.remove('tc-pause-screen--open')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PauseScreen
    }
}
