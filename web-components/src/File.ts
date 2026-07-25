import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import type { ActionItem } from './ActionItems'

const TAG_NAME = 'tc-file'

export interface FileTag {
    id: string
    label: string
    color?: string
}

// Re-export for consumers who need the type when setting menuItems
export type { ActionItem as FileMenuItem }

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Pre-computed module-level icon constants (always rendered)
const fileIconHtml = lucideByName('file')
const menuIconHtml = lucideByName('ellipsis-vertical') || lucideByName('more-vertical')

// Class is named TcFile internally to avoid collision with the DOM global File interface
// (which declares name: string and inherits Blob.size: readonly number). Exported as 'File'
// per the component naming convention.
class TcFile extends HTMLElement {
    private _initialised = false
    private _isMenuOpen = false
    private _menuOutsideHandler: ((e: MouseEvent) => void) | null = null
    private _tagIds: string[] = []
    private _tags: FileTag[] = []
    private _menuItems: ActionItem[] = []

    onNameChange: ((name: string) => void) | null = null
    onTagsChange: ((tagIds: string[]) => void) | null = null
    onMenuItemClick: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['readonly', 'format', 'extension', 'name', 'items', 'size', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeMenuOutsideListener()
        this._isMenuOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const draftValue =
            this.querySelector<HTMLInputElement>('input.tc-file-name:focus')?.value ?? null
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
        if (draftValue !== null) {
            const newInput = this.querySelector<HTMLInputElement>('input.tc-file-name')
            if (newInput) {
                newInput.value = draftValue
                newInput.focus()
            }
        }
    }

    // ── Attribute getters/setters ────────────────────────────────────────────

    get readonly(): boolean {
        return this.hasAttribute('readonly')
    }
    set readonly(v: boolean) {
        if (v) this.setAttribute('readonly', '')
        else this.removeAttribute('readonly')
    }

    get format(): string | null {
        return this.getAttribute('format')
    }
    set format(v: string | null) {
        if (v != null) this.setAttribute('format', v)
        else this.removeAttribute('format')
    }

    get extension(): string | null {
        return this.getAttribute('extension')
    }
    set extension(v: string | null) {
        if (v != null) this.setAttribute('extension', v)
        else this.removeAttribute('extension')
    }

    // 'name' is not a native property on HTMLElement — safe to define.
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get items(): number {
        const raw = this.getAttribute('items')
        if (raw === null) return 0
        const n = parseInt(raw, 10)
        return isNaN(n) ? 0 : Math.max(0, n)
    }
    set items(v: number) {
        this.setAttribute('items', String(Math.max(0, v)))
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw === null) return 0
        const n = parseInt(raw, 10)
        return isNaN(n) ? 0 : Math.max(0, n)
    }
    set size(v: number) {
        this.setAttribute('size', String(Math.max(0, v)))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS property getters/setters ─────────────────────────────────────────

    get tagIds(): string[] {
        return this._tagIds
    }
    set tagIds(v: string[]) {
        this._tagIds = Array.isArray(v) ? v : []
        if (this._initialised) this._patchTags()
    }

    get tags(): FileTag[] {
        return this._tags
    }
    set tags(v: FileTag[]) {
        this._tags = Array.isArray(v) ? v : []
        if (this._initialised) this._patchTags()
    }

    get menuItems(): ActionItem[] {
        return this._menuItems
    }
    set menuItems(v: ActionItem[]) {
        const hadItems = this._menuItems.length > 0
        this._menuItems = Array.isArray(v) ? v : []
        if (this._initialised) {
            const hasItems = this._menuItems.length > 0
            if (hadItems === hasItems) {
                // Visibility unchanged — patch in place
                this._patchMenuItems()
            } else {
                // Visibility changed — structural re-render required
                const draftValue =
                    this.querySelector<HTMLInputElement>('input.tc-file-name:focus')?.value ?? null
                if (this._isMenuOpen) this._closeMenu(false)
                this.render()
                if (draftValue !== null) {
                    const newInput = this.querySelector<HTMLInputElement>('input.tc-file-name')
                    if (newInput) {
                        newInput.value = draftValue
                        newInput.focus()
                    }
                }
            }
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    private _patchTags(): void {
        const tagsEl = this.querySelector<HTMLElement>('.tc-file-tags')
        if (tagsEl) tagsEl.innerHTML = this._buildTagsHtml()
    }

    private _patchMenuItems(): void {
        const menuEl = this.querySelector<HTMLElement>('.tc-file-menu-dropdown')
        if (menuEl) {
            menuEl.innerHTML = this._buildMenuItemsHtml()
            this._wireMenuItemClicks(menuEl)
        }
        const wrap = this.querySelector<HTMLElement>('.tc-file-menu-wrap')
        if (wrap) {
            wrap.classList.toggle(
                'tc-file-menu-wrap--hidden',
                this.readonly || this._menuItems.length === 0,
            )
        }
    }

    private _buildTagsHtml(): string {
        const tagMap = new Map(this._tags.map((t) => [t.id, t]))
        return this._tagIds
            .flatMap((id) => {
                const tag = tagMap.get(id)
                if (!tag) return []
                const styleAttr = tag.color ? ` style="--tc-file-chip-color:${esc(tag.color)}"` : ''
                return [`<span class="tc-file-chip"${styleAttr}>${esc(tag.label)}</span>`]
            })
            .join('')
    }

    private _buildMenuItemsHtml(): string {
        return this._menuItems
            .map((item, idx) => {
                const iconHtml = item.icon ? lucideByName(item.icon) : ''
                const iconSpan = iconHtml
                    ? `<span class="tc-file-menu-icon" aria-hidden="true">${iconHtml}</span>`
                    : ''
                const disabledAttr = item.disabled ? ' disabled aria-disabled="true"' : ''
                return (
                    `<button class="tc-file-menu-item" role="menuitem" type="button" tabindex="-1"` +
                    ` data-idx="${idx}"${disabledAttr}>` +
                    `${iconSpan}<span>${esc(item.label)}</span></button>`
                )
            })
            .join('')
    }

    private _wireMenuItemClicks(menuEl: HTMLElement): void {
        Array.from(
            menuEl.querySelectorAll<HTMLButtonElement>('.tc-file-menu-item:not([disabled])'),
        ).forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length) {
                    this._selectMenuItem(this._menuItems[idx].key)
                }
            })
        })
    }

    private _openMenu(): void {
        this._isMenuOpen = true
        const trigger = this.querySelector<HTMLButtonElement>('.tc-file-menu')
        const menuEl = this.querySelector<HTMLElement>('.tc-file-menu-dropdown')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menuEl) menuEl.classList.add('show')

        const enabled = Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-file-menu-item:not([disabled])'),
        )
        if (enabled.length > 0) enabled[0].focus()

        this._menuOutsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu()
        }
        document.addEventListener('mousedown', this._menuOutsideHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isMenuOpen) return
        this._isMenuOpen = false
        const trigger = this.querySelector<HTMLButtonElement>('.tc-file-menu')
        const menuEl = this.querySelector<HTMLElement>('.tc-file-menu-dropdown')
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menuEl) menuEl.classList.remove('show')
        this._removeMenuOutsideListener()
        if (refocus) trigger?.focus()
    }

    private _removeMenuOutsideListener(): void {
        if (this._menuOutsideHandler) {
            document.removeEventListener('mousedown', this._menuOutsideHandler)
            this._menuOutsideHandler = null
        }
    }

    private _selectMenuItem(key: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-menu-item-click', {
                bubbles: true,
                composed: true,
                detail: { key },
            }),
        )
        if (typeof this.onMenuItemClick === 'function') this.onMenuItemClick(key)
        this._closeMenu()
    }

    // Arrow-function properties so the same reference can be removed if needed.

    private _onNameKeydown = (e: KeyboardEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.tagName !== 'INPUT') return
        if (e.key === 'Enter') {
            e.preventDefault()
            input.blur() // blur handler commits the value
        } else if (e.key === 'Escape') {
            input.value = this.getAttribute('name') ?? ''
            input.blur() // blur handler sees no change → no dispatch
        }
    }

    private _onNameBlur = (e: FocusEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input || input.tagName !== 'INPUT') return
        const draft = input.value
        const current = this.getAttribute('name') ?? ''
        if (draft !== current) {
            // setAttribute triggers attributeChangedCallback → render() synchronously.
            // At that point the input is blurred (:focus doesn't match) so no draft
            // preservation loop occurs.
            this.setAttribute('name', draft)
            this.dispatchEvent(
                new CustomEvent('tc-name-change', {
                    bubbles: true,
                    composed: true,
                    detail: { name: draft },
                }),
            )
            if (typeof this.onNameChange === 'function') this.onNameChange(draft)
        }
    }

    private _onMenuTriggerKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu()
        }
    }

    private _onMenuKeydown = (e: KeyboardEvent): void => {
        const enabled = Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-file-menu-item:not([disabled])'),
        )
        if (!enabled.length) return
        const focused = document.activeElement as HTMLButtonElement
        const curIdx = enabled.indexOf(focused)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            enabled[(curIdx + 1) % enabled.length].focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            enabled[(curIdx - 1 + enabled.length) % enabled.length].focus()
        } else if (e.key === 'Home') {
            e.preventDefault()
            enabled[0].focus()
        } else if (e.key === 'End') {
            e.preventDefault()
            enabled[enabled.length - 1].focus()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            this._closeMenu()
        } else if (e.key === 'Tab') {
            this._closeMenu(false)
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (focused?.classList.contains('tc-file-menu-item') && !focused.disabled) {
                e.preventDefault()
                const idx = parseInt(focused.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length) {
                    this._selectMenuItem(this._menuItems[idx].key)
                }
            }
        }
    }

    private render(): void {
        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="tc-file" aria-hidden="true">',
                '<div class="tc-file-skeleton tc-file-skeleton--icon"></div>',
                '<div class="tc-file-skeleton tc-file-skeleton--name"></div>',
                '<div class="tc-file-skeleton tc-file-skeleton--meta"></div>',
                '</div>',
                '<span class="visually-hidden">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const readonly = this.readonly
        const formatVal = this.getAttribute('format') ?? ''
        const extVal = this.getAttribute('extension') ?? ''
        const nameVal = this.getAttribute('name') ?? ''
        const itemCount = this.items
        const sizeBytes = this.size

        const rowClass = 'tc-file' + (readonly ? ' tc-file--readonly' : '')

        const formatBadgeHtml = formatVal
            ? `<span class="tc-file-format">${esc(formatVal.toUpperCase())}</span>`
            : ''

        const extDisplay = extVal ? (extVal.startsWith('.') ? extVal : '.' + extVal) : ''
        const extHtml = extDisplay ? `<span class="tc-file-ext">${esc(extDisplay)}</span>` : ''

        let nameHtml: string
        if (readonly) {
            nameHtml =
                `<span class="tc-file-name tc-file-name--readonly">${esc(nameVal)}</span>` + extHtml
        } else {
            nameHtml =
                `<input type="text" class="tc-file-name" value="${esc(nameVal)}" aria-label="File name" />` +
                extHtml
        }

        const sizeHtml =
            sizeBytes > 0 ? `<span class="tc-file-size">${esc(formatBytes(sizeBytes))}</span>` : ''
        const itemsHtml =
            itemCount > 0
                ? `<span class="tc-file-items">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>`
                : ''
        const metaHtml =
            sizeHtml || itemsHtml ? `<div class="tc-file-meta">${sizeHtml}${itemsHtml}</div>` : ''

        const menuWrapHidden = readonly || this._menuItems.length === 0
        const menuWrapClass =
            'tc-file-menu-wrap' + (menuWrapHidden ? ' tc-file-menu-wrap--hidden' : '')

        // Menu dropdown is always rendered so _patchMenuItems() can find it.
        const menuHtml =
            `<div class="${menuWrapClass}">` +
            `<button type="button" class="tc-file-menu" aria-haspopup="menu"` +
            ` aria-expanded="false" aria-label="Actions">${menuIconHtml}</button>` +
            `<div class="tc-file-menu-dropdown" role="menu">${this._buildMenuItemsHtml()}</div>` +
            `</div>`

        this.innerHTML =
            `<div class="${rowClass}">` +
            `<span class="tc-file-icon" aria-hidden="true">${fileIconHtml}</span>` +
            formatBadgeHtml +
            nameHtml +
            metaHtml +
            `<div class="tc-file-tags">${this._buildTagsHtml()}</div>` +
            menuHtml +
            `</div>`

        // Wire event listeners after innerHTML replacement.
        if (!readonly) {
            const nameInput = this.querySelector<HTMLInputElement>('input.tc-file-name')
            if (nameInput) {
                nameInput.addEventListener('keydown', this._onNameKeydown)
                nameInput.addEventListener('blur', this._onNameBlur)
            }

            const menuTrigger = this.querySelector<HTMLButtonElement>('.tc-file-menu')
            if (menuTrigger) {
                menuTrigger.addEventListener('click', () => {
                    if (this._isMenuOpen) this._closeMenu(false)
                    else this._openMenu()
                })
                menuTrigger.addEventListener('keydown', this._onMenuTriggerKeydown)
            }

            const menuEl = this.querySelector<HTMLElement>('.tc-file-menu-dropdown')
            if (menuEl) {
                this._wireMenuItemClicks(menuEl)
                menuEl.addEventListener('keydown', this._onMenuKeydown)
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TcFile
    }
}

// Export as 'File' so the public API matches the task specification and react-components parity.
export { TcFile as File }
