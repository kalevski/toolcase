import { DialogBase, esc } from './internal/dialog-base'
const TAG_NAME = 'tc-pause-menu'

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

/**
 * tc-pause-menu — a modal pause overlay (backdrop + centred dialog + arrow-nav
 * menu) on the shared {@link DialogBase} scaffold (focus trap, scroll lock,
 * Escape-to-close, Tab cycling). Adds Arrow navigation + Enter/Space activation,
 * the menu items, and a footer Resume button. Items are supplied via the `items`
 * JS property and each fires `tc-select`.
 *
 * tc-pause-screen is a preset alias that drops the footer, seeds a default
 * resume/restart/quit item set, and re-dispatches tc-resume / tc-restart /
 * tc-quit for those ids. Knobs (`default-items`, `resume-footer`, `menu-title` /
 * `screen-title`) let either tag be reconfigured. Both tags render the
 * `tc-pause-menu__*` BEM scheme, so classPrefix is pinned regardless of localName.
 */
export class PauseMenu extends DialogBase {
    private _items: PauseMenuItem[] = []

    onResume: (() => void) | null = null
    onRestart: (() => void) | null = null
    onQuit: (() => void) | null = null
    onClose: (() => void) | null = null
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'menu-title', 'screen-title', 'default-items', 'resume-footer']
    }

    // Both tags render the tc-pause-menu BEM scheme; the alias must not key off
    // its own localName (DialogBase's default) or it would look for the wrong
    // panel/backdrop selectors.
    protected get classPrefix(): string {
        return 'tc-pause-menu'
    }

    private get _config(): PauseConfig {
        return TAG_CONFIG[this.localName] ?? DEFAULT_CONFIG
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

    // ── DialogBase hooks ─────────────────────────────────────────────────────────

    protected onCloseRequest(): void {
        this._requestClose()
    }

    protected onExtraKeydown(e: KeyboardEvent): void {
        // Arrow navigation within menu items.
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const items = Array.from(
                this.querySelectorAll<HTMLElement>(
                    '.tc-pause-menu__item:not(.tc-pause-menu__item--disabled)',
                ),
            )
            if (items.length === 0) return
            e.preventDefault()
            const current = items.indexOf(document.activeElement as HTMLElement)
            const next =
                e.key === 'ArrowDown'
                    ? (current + 1) % items.length
                    : (current - 1 + items.length) % items.length
            items[next].focus()
            return
        }

        // Enter/Space activate the currently focused menu item.
        if (e.key === 'Enter' || e.key === ' ') {
            const item = (document.activeElement as Element | null)?.closest<HTMLElement>(
                '.tc-pause-menu__item',
            )
            if (
                item &&
                this.contains(item) &&
                !item.classList.contains('tc-pause-menu__item--disabled')
            ) {
                e.preventDefault()
                const id = item.dataset.id
                if (id) this._fireSelect(id)
            }
        }
    }

    protected onBodyClick(e: MouseEvent): void {
        const target = e.target as Element | null
        if (!target) return

        if (target.closest('.tc-pause-menu__resume')) {
            this.dispatchEvent(
                new CustomEvent('tc-resume', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onResume === 'function') this.onResume()
            return
        }

        const item = target.closest<HTMLElement>('.tc-pause-menu__item')
        if (!item || !this.contains(item)) return
        if (item.classList.contains('tc-pause-menu__item--disabled')) return
        const id = item.dataset.id
        if (id) this._fireSelect(id)
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
        return this._effectiveItems()
            .map((item) => {
                const cls = [
                    'tc-pause-menu__item',
                    item.disabled ? 'tc-pause-menu__item--disabled' : '',
                ]
                    .filter(Boolean)
                    .join(' ')
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
            })
            .join('')
    }

    private _syncItems(): void {
        const list = this.querySelector('.tc-pause-menu__items')
        if (list) list.innerHTML = this._buildItemsHtml()
    }

    private _fireSelect(id: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)

        // Preset convenience routing — re-dispatch the named lifecycle events for
        // the canonical resume/restart/quit ids.
        if (!this._config.routeItemEvents) return
        if (id === 'resume') {
            this.dispatchEvent(
                new CustomEvent('tc-resume', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onResume === 'function') this.onResume()
        } else if (id === 'restart') {
            this.dispatchEvent(
                new CustomEvent('tc-restart', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onRestart === 'function') this.onRestart()
        } else if (id === 'quit') {
            this.dispatchEvent(
                new CustomEvent('tc-quit', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onQuit === 'function') this.onQuit()
        }
    }

    private _requestClose(): void {
        this.dispatchEvent(
            new CustomEvent('tc-close', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onClose === 'function') this.onClose()
    }

    // ── Render ──────────────────────────────────────────────────────────────────

    protected render(): void {
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
