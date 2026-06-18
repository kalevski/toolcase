const TAG_NAME = 'tc-pause-menu'

let _idCounter = 0

export interface PauseMenuItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

// Opt-in default item set (the classic resume / restart / quit list). Seeded
// when `default-items` is present, or always for the tc-pause-screen preset.
const DEFAULT_ITEMS: PauseMenuItem[] = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'quit', label: 'Quit' },
]

interface PauseConfig {
    eyebrow: string
    titleAttr: string
    defaultTitle: string
    footer: boolean
    seedDefaultItems: boolean
    routeItemEvents: boolean
}

// Per-tag presentation/behaviour. tc-pause-menu is the bare canonical (a footer
// Resume button, no seeded items, items fire only tc-select). tc-pause-screen is
// the preset alias: no footer, the resume/restart/quit default item set, and
// selecting resume/restart/quit also re-dispatches the matching convenience
// event (tc-resume / tc-restart / tc-quit).
const TAG_CONFIG: Record<string, PauseConfig> = {
    'tc-pause-menu': {
        eyebrow: 'Paused',
        titleAttr: 'menu-title',
        defaultTitle: 'Game Paused',
        footer: true,
        seedDefaultItems: false,
        routeItemEvents: false,
    },
    'tc-pause-screen': {
        eyebrow: 'Game Paused',
        titleAttr: 'screen-title',
        defaultTitle: 'Paused',
        footer: false,
        seedDefaultItems: true,
        routeItemEvents: true,
    },
}
const DEFAULT_CONFIG = TAG_CONFIG['tc-pause-menu']

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

/**
 * tc-pause-menu — a modal pause overlay (backdrop + centred dialog + arrow-nav
 * menu) with focus trap, scroll lock, Escape-to-close, Tab cycling, Arrow
 * navigation and Enter/Space activation. Items are supplied via the `items` JS
 * property and each fires `tc-select`; a footer Resume button fires `tc-resume`.
 *
 * tc-pause-screen is a preset alias that drops the footer, seeds a default
 * resume/restart/quit item set, and re-dispatches tc-resume / tc-restart /
 * tc-quit for those ids. Knobs (`default-items`, `resume-footer`, `menu-title` /
 * `screen-title`) let either tag be reconfigured.
 */
export class PauseMenu extends HTMLElement {
    private _initialised = false
    private _items: PauseMenuItem[] = []
    private _previousFocus: Element | null = null
    private _idPrefix: string

    onResume: (() => void) | null = null
    onRestart: (() => void) | null = null
    onQuit: (() => void) | null = null
    onClose: (() => void) | null = null
    onSelect: ((id: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-pause-menu-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'menu-title', 'screen-title', 'default-items', 'resume-footer']
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

        // Structural attribute — re-render, then re-apply visibility if open.
        this.render()
        if (this.open) this._applyOpenState(true)
    }

    private get _config(): PauseConfig {
        return TAG_CONFIG[this.localName] ?? DEFAULT_CONFIG
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get menuTitle(): string {
        return this.getAttribute('menu-title') ?? ''
    }
    set menuTitle(v: string) {
        if (v) this.setAttribute('menu-title', v)
        else this.removeAttribute('menu-title')
    }

    // Alias accessor for the tc-pause-screen preset (drives the `screen-title`
    // attribute it reads for its title).
    get screenTitle(): string {
        return this.getAttribute('screen-title') ?? ''
    }
    set screenTitle(v: string) {
        if (v) this.setAttribute('screen-title', v)
        else this.removeAttribute('screen-title')
    }

    get items(): PauseMenuItem[] {
        return this._effectiveItems().slice()
    }
    set items(value: PauseMenuItem[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this._syncItems()
    }

    // ── Private helpers ─────────────────────────────────────────────────────────

    private _shouldSeedDefaults(): boolean {
        return this.hasAttribute('default-items') || this._config.seedDefaultItems
    }

    private _showFooter(): boolean {
        return this.hasAttribute('resume-footer') || this._config.footer
    }

    // Items to render: explicit items when present, else the default set when
    // seeding is enabled (preset / `default-items`), else nothing.
    private _effectiveItems(): PauseMenuItem[] {
        if (this._items.length) return this._items
        if (this._shouldSeedDefaults()) return DEFAULT_ITEMS
        return []
    }

    private _buildItemsHtml(): string {
        return this._effectiveItems().map(item => {
            const cls = [
                'tc-pause-menu__item',
                item.disabled ? 'tc-pause-menu__item--disabled' : '',
            ].filter(Boolean).join(' ')
            const badgeHtml = item.badge
                ? `<span class="tc-pause-menu__item-badge">${esc(item.badge)}</span>`
                : ''
            return (
                `<div role="menuitem"` +
                ` class="${cls}"` +
                ` data-id="${esc(item.id)}"` +
                ` tabindex="${item.disabled ? '-1' : '0'}"` +
                (item.disabled ? ` aria-disabled="true"` : '') +
                `>` +
                `<span class="tc-pause-menu__item-label">${esc(item.label)}</span>` +
                badgeHtml +
                `</div>`
            )
        }).join('')
    }

    private _syncItems(): void {
        const list = this.querySelector('.tc-pause-menu__items')
        if (list) list.innerHTML = this._buildItemsHtml()
    }

    private _fireSelect(id: string): void {
        this.dispatchEvent(new CustomEvent('tc-select', {
            bubbles: true,
            composed: true,
            detail: { id },
        }))
        if (typeof this.onSelect === 'function') this.onSelect(id)

        // Preset convenience routing — re-dispatch the named lifecycle events for
        // the canonical resume/restart/quit ids.
        if (!this._config.routeItemEvents) return
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
        const panel = this.querySelector<HTMLElement>('.tc-pause-menu__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-pause-menu__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding the open class to trigger the CSS transition.
            requestAnimationFrame(() => {
                this.classList.add('tc-pause-menu--open')
                panel?.setAttribute('aria-hidden', 'false')
                this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this.classList.remove('tc-pause-menu--open')
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
            const panel = this.querySelector<HTMLElement>('.tc-pause-menu__panel')
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

        // Arrow navigation within menu items.
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const items = Array.from(
                this.querySelectorAll<HTMLElement>('.tc-pause-menu__item:not(.tc-pause-menu__item--disabled)'),
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

        // Enter/Space activate the currently focused menu item.
        if (e.key === 'Enter' || e.key === ' ') {
            const item = (document.activeElement as Element | null)
                ?.closest<HTMLElement>('.tc-pause-menu__item')
            if (item && this.contains(item) && !item.classList.contains('tc-pause-menu__item--disabled')) {
                e.preventDefault()
                const id = item.dataset.id
                if (id) this._fireSelect(id)
            }
        }
    }

    private _onBackdropClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.classList.contains('tc-pause-menu__backdrop')) {
            this._requestClose()
        }
    }

    private _onResumeClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.closest('.tc-pause-menu__resume')) {
            this.dispatchEvent(new CustomEvent('tc-resume', {
                bubbles: true,
                composed: true,
                detail: {},
            }))
            if (typeof this.onResume === 'function') this.onResume()
        }
    }

    private _onItemClick = (e: MouseEvent): void => {
        const item = (e.target as Element)?.closest<HTMLElement>('.tc-pause-menu__item')
        if (!item || !this.contains(item)) return
        if (item.classList.contains('tc-pause-menu__item--disabled')) return
        const id = item.dataset.id
        if (id) this._fireSelect(id)
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onBackdropClick)
        this.addEventListener('click', this._onResumeClick)
        this.addEventListener('click', this._onItemClick)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onBackdropClick)
        this.removeEventListener('click', this._onResumeClick)
        this.removeEventListener('click', this._onItemClick)
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    private render(): void {
        const config = this._config
        const isOpen = this.open
        const labelId = `${this._idPrefix}-title`
        const hiddenAttr = isOpen ? '' : ' hidden'
        const titleText = this.getAttribute(config.titleAttr) ?? config.defaultTitle

        const footerHtml = this._showFooter()
            ? `<div class="tc-pause-menu__footer">` +
              `<button type="button" class="tc-pause-menu__resume">Resume</button>` +
              `</div>`
            : ''

        this.innerHTML =
            `<div class="tc-pause-menu__backdrop" aria-hidden="true"${hiddenAttr}></div>` +
            `<div class="tc-pause-menu__panel" role="dialog" aria-modal="true"` +
            ` aria-labelledby="${labelId}" tabindex="-1"` +
            ` aria-hidden="${isOpen ? 'false' : 'true'}"${hiddenAttr}>` +
            `<div class="tc-pause-menu__header">` +
            `<span class="tc-pause-menu__eyebrow">${esc(config.eyebrow)}</span>` +
            `<h2 class="tc-pause-menu__title" id="${labelId}">${esc(titleText)}</h2>` +
            `</div>` +
            `<div class="tc-pause-menu__items" role="menu" aria-label="${esc(titleText)}">` +
            this._buildItemsHtml() +
            `</div>` +
            footerHtml +
            `</div>`

        if (isOpen) this.classList.add('tc-pause-menu--open')
        else this.classList.remove('tc-pause-menu--open')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PauseMenu
        'tc-pause-screen': PauseMenu
    }
}
