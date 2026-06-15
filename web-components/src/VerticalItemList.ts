import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-vertical-item-list'

let _idCounter = 0

export interface VerticalItemListItem {
    key: string
    icon?: string
    text: string
    badge?: string | number
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// kebab-case lucide name → PascalCase lookup in lucide-static, wrapped in icon().
function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr, 'tc-vertical-item-list-icon')
}

export class VerticalItemList extends HTMLElement {
    private _initialised = false
    private _items: VerticalItemListItem[] = []
    private _internalKey: string | null = null
    private _idPrefix: string

    // Optional callback fired alongside the tc-select CustomEvent.
    onSelect: ((key: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-vil-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['active-key', 'default-active-key', 'disabled', 'loading', 'loading-count']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-vertical-item-list-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
        // Arrow-function references are stable, so re-adding on reconnect is a no-op.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // A controlled active-key change only needs an in-place patch (the menu
        // markers + content association move); the slotted content is untouched.
        if (name === 'active-key' && !this.loading) {
            this._applyActiveState(false)
            return
        }
        this._rerenderWithSlots()
    }

    // ── Props ──────────────────────────────────────────────────────────────────

    get items(): VerticalItemListItem[] {
        return this._items
    }
    set items(v: VerticalItemListItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get activeKey(): string | null {
        return this.getAttribute('active-key')
    }
    set activeKey(v: string | null) {
        if (v != null) this.setAttribute('active-key', v)
        else this.removeAttribute('active-key')
    }

    get defaultActiveKey(): string | null {
        return this.getAttribute('default-active-key')
    }
    set defaultActiveKey(v: string | null) {
        if (v != null) this.setAttribute('default-active-key', v)
        else this.removeAttribute('default-active-key')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '5', 10) || 5)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    // ── Active-key resolution ────────────────────────────────────────────────────

    private get _isControlled(): boolean {
        return this.hasAttribute('active-key')
    }

    /** The currently active item key. */
    private _getActiveKey(): string {
        const keys = this._items.map(i => i.key)
        if (this._isControlled) {
            return this.getAttribute('active-key') ?? ''
        }
        if (this._internalKey && keys.includes(this._internalKey)) return this._internalKey
        const dflt = this.getAttribute('default-active-key')
        if (dflt && keys.includes(dflt)) return dflt
        return this._items[0]?.key ?? ''
    }

    /** The key that owns roving tabindex 0 (active, else first item). */
    private _getTabbableKey(activeKey: string): string {
        const keys = this._items.map(i => i.key)
        if (keys.includes(activeKey)) return activeKey
        return this._items[0]?.key ?? activeKey
    }

    // ── Selection ────────────────────────────────────────────────────────────────

    private _select(key: string, focus: boolean): void {
        if (this.disabled) return
        const item = this._items.find(i => i.key === key)
        if (!item) return

        if (!this._isControlled) {
            const changed = this._internalKey !== key
            this._internalKey = key
            if (changed) this._applyActiveState(focus)
            else if (focus) this._focusItem(key)
        } else if (focus) {
            // Controlled: the active item does not move on click; only focus does.
            this._focusItem(key)
        }

        this.dispatchEvent(new CustomEvent('tc-select', {
            bubbles: true,
            composed: true,
            detail: { key },
        }))
        if (typeof this.onSelect === 'function') this.onSelect(key)
    }

    private _focusItem(key: string): void {
        const el = this.querySelector<HTMLElement>(`[role="tab"][data-key="${CSS.escape(key)}"]`)
        if (el) el.focus()
    }

    /** Move roving focus to the item at `idx` (wrapping) without selecting it. */
    private _focusIndex(idx: number): void {
        const btns = Array.from(this.querySelectorAll<HTMLElement>('[role="tab"]'))
        if (btns.length === 0) return
        const clamped = (idx + btns.length) % btns.length
        btns.forEach((b, i) => b.setAttribute('tabindex', i === clamped ? '0' : '-1'))
        btns[clamped].focus()
    }

    /** Patch active markers + content association on the live DOM (no full render). */
    private _applyActiveState(focus: boolean): void {
        if (this.loading) return
        const activeKey = this._getActiveKey()
        const tabbableKey = this._getTabbableKey(activeKey)
        let activeId = ''

        this.querySelectorAll<HTMLElement>('[role="tab"]').forEach(btn => {
            const k = btn.dataset.key ?? ''
            const isActive = k === activeKey
            btn.setAttribute('aria-selected', String(isActive))
            if (isActive) {
                btn.setAttribute('aria-current', 'true')
                activeId = btn.id
            } else {
                btn.removeAttribute('aria-current')
            }
            btn.setAttribute('tabindex', k === tabbableKey ? '0' : '-1')
            btn.classList.toggle('tc-vertical-item-list-item--active', isActive)
        })

        const panel = this.querySelector('.tc-vertical-item-list-content')
        if (panel) {
            if (activeId) panel.setAttribute('aria-labelledby', activeId)
            else panel.removeAttribute('aria-labelledby')
        }

        if (focus) this._focusItem(activeKey)
    }

    // ── Events ─────────────────────────────────────────────────────────────────────

    private _onClick = (e: Event): void => {
        if (this.disabled || this.loading) return
        const target = e.target as Element | null
        const btn = target?.closest<HTMLElement>('[role="tab"]')
        if (!btn || !this.contains(btn)) return
        const key = btn.dataset.key
        if (key != null) this._select(key, false)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (this.disabled || this.loading) return
        const target = e.target as Element | null
        const btn = target?.closest<HTMLElement>('[role="tab"]')
        if (!btn) return

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const key = btn.dataset.key
            if (key != null) this._select(key, true)
            return
        }

        const btns = Array.from(this.querySelectorAll<HTMLElement>('[role="tab"]'))
        const idx = btns.indexOf(btn)
        if (idx === -1) return

        let next = -1
        if (e.key === 'ArrowDown') next = idx + 1
        else if (e.key === 'ArrowUp') next = idx - 1
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = btns.length - 1

        if (next !== -1) {
            e.preventDefault()
            this._focusIndex(next)
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────────

    private _rerenderWithSlots(): void {
        const inner = this.querySelector('.tc-vertical-item-list-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-vertical-item-list-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    private render(): void {
        const disabled = this.disabled
        const loading = this.loading

        if (disabled) this.setAttribute('aria-disabled', 'true')
        else this.removeAttribute('aria-disabled')

        let menuHtml: string
        let activeId = ''

        if (loading) {
            this.setAttribute('aria-busy', 'true')
            const rows = Array.from({ length: this.loadingCount }, () =>
                '<div class="tc-vertical-item-list-item tc-vertical-item-list-item--skeleton" aria-hidden="true">' +
                '<span class="tc-vertical-item-list-skeleton"></span>' +
                '</div>'
            ).join('')
            menuHtml =
                '<div class="tc-vertical-item-list-menu" role="presentation">' +
                '<span class="visually-hidden" role="status">Loading…</span>' +
                rows +
                '</div>'
        } else {
            this.removeAttribute('aria-busy')
            const activeKey = this._getActiveKey()
            const tabbableKey = this._getTabbableKey(activeKey)

            const itemsHtml = this._items.map((item, i) => {
                const id = `${this._idPrefix}-item-${i}`
                const isActive = item.key === activeKey
                if (isActive) activeId = id
                const iconHtml = item.icon ? lucideByName(item.icon) : ''
                const textHtml = `<span class="tc-vertical-item-list-text">${esc(item.text)}</span>`
                const badgeHtml = item.badge != null && item.badge !== ''
                    ? `<span class="tc-vertical-item-list-badge">${esc(String(item.badge))}</span>`
                    : ''
                return `<button` +
                    ` id="${id}"` +
                    ` type="button"` +
                    ` class="tc-vertical-item-list-item${isActive ? ' tc-vertical-item-list-item--active' : ''}"` +
                    ` role="tab"` +
                    ` data-key="${esc(item.key)}"` +
                    ` aria-selected="${isActive}"` +
                    (isActive ? ' aria-current="true"' : '') +
                    ` tabindex="${item.key === tabbableKey ? '0' : '-1'}"` +
                    (disabled ? ' disabled aria-disabled="true"' : '') +
                    `>${iconHtml}${textHtml}${badgeHtml}</button>`
            }).join('')

            menuHtml = `<div class="tc-vertical-item-list-menu" role="tablist" aria-orientation="vertical">${itemsHtml}</div>`
        }

        const labelledby = activeId ? ` aria-labelledby="${activeId}"` : ''
        this.innerHTML =
            `<div class="tc-vertical-item-list">` +
                menuHtml +
                `<div class="tc-vertical-item-list-content" role="tabpanel" tabindex="0"${labelledby}></div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VerticalItemList
    }
}
