import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { ActionItem } from './ActionItems'

const TAG_NAME = 'tc-build'

export type BuildStatus = 'pass' | 'fail' | 'running' | 'queued'
export type BuildBadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'

const STATUSES: BuildStatus[] = ['pass', 'fail', 'running', 'queued']
const BADGE_VARIANTS: BuildBadgeVariant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info']

const STATUS_META: Record<BuildStatus, { lucideKey: string; ariaLabel: string }> = {
    pass: { lucideKey: 'Check', ariaLabel: 'Pass' },
    fail: { lucideKey: 'X', ariaLabel: 'Fail' },
    running: { lucideKey: 'Loader2', ariaLabel: 'Running' },
    queued: { lucideKey: 'Clock', ariaLabel: 'Queued' },
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideHtml(name: string, className?: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr, className)
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
    return `${(bytes / 1073741824).toFixed(2)} GB`
}

function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    const m = Math.floor(ms / 60000)
    const s = Math.round((ms % 60000) / 1000)
    if (ms < 3600000) return s > 0 ? `${m}m ${s}s` : `${m}m`
    const h = Math.floor(ms / 3600000)
    const rem = Math.floor((ms % 3600000) / 60000)
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`
}

// Resolved once at module load — always rendered when a menu is present
const moreVerticalIconHtml = lucideHtml('MoreVertical', 'tc-build-menu-icon')

export class Build extends HTMLElement {
    private _initialised = false
    private _menuItems: ActionItem[] = []
    private _onClick: (() => void) | null = null
    private _onMenuItemClick: ((key: string) => void) | null = null
    private _isMenuOpen = false
    private _outsideHandler: ((e: MouseEvent) => void) | null = null

    static get observedAttributes(): string[] {
        return ['name', 'date', 'size', 'duration', 'status', 'badge', 'badge-variant', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._bindListeners()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeOutsideListener()
        this._isMenuOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
        this._bindListeners()
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get date(): string | null {
        return this.getAttribute('date')
    }
    set date(v: string | null) {
        if (v != null) this.setAttribute('date', v)
        else this.removeAttribute('date')
    }

    get size(): number | null {
        const raw = parseInt(this.getAttribute('size') ?? '', 10)
        return isNaN(raw) ? null : raw
    }
    set size(v: number | null) {
        if (v != null) this.setAttribute('size', String(v))
        else this.removeAttribute('size')
    }

    get duration(): number | null {
        const raw = parseInt(this.getAttribute('duration') ?? '', 10)
        return isNaN(raw) ? null : raw
    }
    set duration(v: number | null) {
        if (v != null) this.setAttribute('duration', String(v))
        else this.removeAttribute('duration')
    }

    get status(): BuildStatus {
        const v = this.getAttribute('status') as BuildStatus
        return STATUSES.includes(v) ? v : 'queued'
    }
    set status(v: BuildStatus) {
        this.setAttribute('status', v)
    }

    get badge(): string | null {
        return this.getAttribute('badge')
    }
    set badge(v: string | null) {
        if (v != null) this.setAttribute('badge', v)
        else this.removeAttribute('badge')
    }

    get badgeVariant(): BuildBadgeVariant {
        const v = this.getAttribute('badge-variant') as BuildBadgeVariant
        return BADGE_VARIANTS.includes(v) ? v : 'secondary'
    }
    set badgeVariant(v: BuildBadgeVariant) {
        this.setAttribute('badge-variant', v)
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get menuItems(): ActionItem[] {
        return this._menuItems
    }
    set menuItems(v: ActionItem[]) {
        this._menuItems = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isMenuOpen) this._closeMenu(false)
            this.render()
            this._bindListeners()
        }
    }

    get onClick(): (() => void) | null {
        return this._onClick
    }
    set onClick(v: (() => void) | null) {
        this._onClick = v
        if (this._initialised) {
            // Toggle clickable class without full re-render
            const inner = this.querySelector<HTMLElement>('.tc-build')
            if (inner) {
                const isClickable = typeof v === 'function'
                inner.classList.toggle('tc-build--clickable', isClickable)
                if (isClickable) {
                    inner.setAttribute('tabindex', '0')
                    inner.setAttribute('role', 'button')
                } else {
                    inner.removeAttribute('tabindex')
                    inner.removeAttribute('role')
                }
            }
        }
    }

    get onMenuItemClick(): ((key: string) => void) | null {
        return this._onMenuItemClick
    }
    set onMenuItemClick(v: ((key: string) => void) | null) {
        this._onMenuItemClick = v
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-build-menu-trigger')
    }

    private _getMenu(): HTMLElement | null {
        return this.querySelector('.tc-build-menu')
    }

    private _getEnabledItems(): HTMLButtonElement[] {
        return Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-build-menu-item:not([disabled])')
        )
    }

    private _renderMenuItems(): string {
        return this._menuItems
            .map((item, idx) => {
                if (item.divider) {
                    return `<div class="tc-build-menu-divider" role="separator"></div>`
                }
                const disabled = item.disabled === true
                const dangerCls = item.danger ? ' tc-build-menu-item--danger' : ''
                const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
                return (
                    `<button class="tc-build-menu-item${dangerCls}" role="menuitem" ` +
                    `type="button" tabindex="-1" data-idx="${idx}"${disabledAttr}>` +
                    `<span>${esc(item.label)}</span></button>`
                )
            })
            .join('')
    }

    private render(): void {
        if (this.loading) {
            this.innerHTML = [
                '<div class="tc-build tc-build--loading" aria-busy="true">',
                '<span class="tc-build-status-icon-wrap tc-build-skeleton tc-build-skeleton--icon" aria-hidden="true">',
                '<span class="visually-hidden" role="status">Loading…</span>',
                '</span>',
                '<div class="tc-build-body">',
                '<div class="tc-build-skeleton tc-build-skeleton--name" aria-hidden="true"></div>',
                '<div class="tc-build-skeleton tc-build-skeleton--meta" aria-hidden="true"></div>',
                '</div>',
                '</div>',
            ].join('')
            return
        }

        const status = this.status
        const { lucideKey, ariaLabel } = STATUS_META[status]
        const statusIconHtml = lucideHtml(lucideKey, `tc-build-status-icon tc-build-status-icon--${status}`)
        const nameVal = this.getAttribute('name')
        const dateVal = this.getAttribute('date')
        const sizeRaw = parseInt(this.getAttribute('size') ?? '', 10)
        const sizeVal = isNaN(sizeRaw) ? null : sizeRaw
        const durRaw = parseInt(this.getAttribute('duration') ?? '', 10)
        const durVal = isNaN(durRaw) ? null : durRaw
        const badgeVal = this.getAttribute('badge')
        const badgeVariant = this.badgeVariant
        const hasMenu = this._menuItems.length > 0
        const hasClick = typeof this._onClick === 'function'

        const clickableClass = hasClick ? ' tc-build--clickable' : ''
        const menuClass = hasMenu ? ' tc-build--has-menu' : ''
        const tabindexAttr = hasClick ? ' tabindex="0" role="button"' : ''

        // Meta row
        const metaItems: string[] = []
        if (dateVal) metaItems.push(`<span class="tc-build-meta-item">${esc(dateVal)}</span>`)
        if (sizeVal != null) metaItems.push(`<span class="tc-build-meta-item">${esc(formatBytes(sizeVal))}</span>`)
        if (durVal != null) metaItems.push(`<span class="tc-build-meta-item">${esc(formatDuration(durVal))}</span>`)
        const sep = '<span class="tc-build-meta-sep" aria-hidden="true">&middot;</span>'
        const metaHtml =
            metaItems.length > 0
                ? `<div class="tc-build-meta">${metaItems.join(sep)}</div>`
                : ''

        const badgeHtml =
            badgeVal != null
                ? `<span class="tc-build-badge badge text-bg-${esc(badgeVariant)}">${esc(badgeVal)}</span>`
                : ''

        const menuHtml = hasMenu
            ? [
                  '<div class="tc-build-menu-wrapper">',
                  '<button class="tc-build-menu-trigger" type="button" aria-haspopup="menu" aria-expanded="false">',
                  '<span class="visually-hidden">Actions</span>',
                  moreVerticalIconHtml,
                  '</button>',
                  '<div class="tc-build-menu" role="menu" aria-label="Build actions">',
                  this._renderMenuItems(),
                  '</div>',
                  '</div>',
              ].join('')
            : ''

        this.innerHTML = [
            `<div class="tc-build tc-build--status-${status}${clickableClass}${menuClass}"${tabindexAttr}>`,
            `<span class="tc-build-status-icon-wrap" role="img" aria-label="${esc(ariaLabel)}">`,
            statusIconHtml,
            '</span>',
            '<div class="tc-build-body">',
            nameVal != null ? `<div class="tc-build-name">${esc(nameVal)}</div>` : '',
            metaHtml,
            badgeHtml,
            '</div>',
            menuHtml,
            '</div>',
        ].join('')
    }

    private _bindListeners(): void {
        const inner = this.querySelector<HTMLElement>('.tc-build')
        if (!inner) return

        // Whole-card click (ignore clicks inside the menu wrapper)
        inner.addEventListener('click', (e: Event) => {
            if ((e.target as HTMLElement).closest('.tc-build-menu-wrapper')) return
            this.dispatchEvent(new CustomEvent('tc-click', { bubbles: true, composed: true }))
            if (typeof this._onClick === 'function') this._onClick()
        })

        // Keyboard activation on the card div when acting as a button
        inner.addEventListener('keydown', (e: Event) => {
            const ke = e as KeyboardEvent
            if (ke.key === 'Enter' || ke.key === ' ') {
                if ((ke.target as HTMLElement).closest('.tc-build-menu-wrapper')) return
                ke.preventDefault()
                this.dispatchEvent(new CustomEvent('tc-click', { bubbles: true, composed: true }))
                if (typeof this._onClick === 'function') this._onClick()
            }
        })

        // Menu trigger
        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', (e: Event) => {
                e.stopPropagation()
                if (this._isMenuOpen) this._closeMenu()
                else this._openMenu()
            })
            trigger.addEventListener('keydown', (e: Event) => this._onTriggerKeydown(e as KeyboardEvent))
        }

        // Menu keyboard navigation
        const menu = this._getMenu()
        if (menu) {
            menu.addEventListener('keydown', (e: Event) => this._onMenuKeydown(e as KeyboardEvent))
        }

        // Menu item clicks
        Array.from(this.querySelectorAll<HTMLButtonElement>('.tc-build-menu-item:not([disabled])')).forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length) {
                    this._selectItem(this._menuItems[idx].key)
                }
            })
        })
    }

    private _openMenu(focusLast = false): void {
        this._isMenuOpen = true
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menu) menu.classList.add('show')

        const enabled = this._getEnabledItems()
        if (enabled.length > 0) {
            const target = focusLast ? enabled[enabled.length - 1] : enabled[0]
            target.setAttribute('tabindex', '0')
            target.focus()
        }

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu(false)
        }
        document.addEventListener('mousedown', this._outsideHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isMenuOpen) return
        this._isMenuOpen = false
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menu) menu.classList.remove('show')
        this._getEnabledItems().forEach(btn => btn.setAttribute('tabindex', '-1'))
        this._removeOutsideListener()
        if (refocus) trigger?.focus()
    }

    private _removeOutsideListener(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
    }

    private _selectItem(key: string): void {
        this.dispatchEvent(new CustomEvent('tc-menu-select', {
            bubbles: true,
            composed: true,
            detail: { key },
        }))
        if (typeof this._onMenuItemClick === 'function') this._onMenuItemClick(key)
        this._closeMenu()
    }

    private _onTriggerKeydown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu(true)
        }
    }

    private _onMenuKeydown(e: KeyboardEvent): void {
        const enabled = this._getEnabledItems()
        if (enabled.length === 0) return

        const focused = document.activeElement as HTMLButtonElement
        const currentIdx = enabled.indexOf(focused)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = enabled[(currentIdx + 1) % enabled.length]
            next.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            next.focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = enabled[(currentIdx - 1 + enabled.length) % enabled.length]
            prev.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            prev.focus()
        } else if (e.key === 'Home') {
            e.preventDefault()
            enabled[0].setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            enabled[0].focus()
        } else if (e.key === 'End') {
            e.preventDefault()
            const last = enabled[enabled.length - 1]
            last.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            last.focus()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            this._closeMenu()
        } else if (e.key === 'Tab') {
            this._closeMenu(false)
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (focused && focused.classList.contains('tc-build-menu-item') && !focused.disabled) {
                e.preventDefault()
                const idx = parseInt(focused.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length) {
                    this._selectItem(this._menuItems[idx].key)
                }
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Build
    }
}
