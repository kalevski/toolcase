import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import type { ActionItem } from './ActionItems'
import type { ExtendedSelect, ExtendedSelectItem } from './ExtendedSelect'

const TAG_NAME = 'tc-file'

export interface FileTag {
    id: string
    label: string
    /** Accepted for API compatibility but not rendered — chips always use the
     *  uniform primary-badge fill. */
    color?: string
}

// Re-export for consumers who need the types when setting menuItems/categories
export type { ActionItem as FileMenuItem }
export type { ExtendedSelectItem as FileCategoryItem }

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Extension → lucide icon name. Unknown extensions fall back to the generic file icon.
const EXT_ICON_MAP: Record<string, string> = {
    // images
    png: 'file-image',
    jpg: 'file-image',
    jpeg: 'file-image',
    gif: 'file-image',
    webp: 'file-image',
    svg: 'file-image',
    ico: 'file-image',
    bmp: 'file-image',
    avif: 'file-image',
    // video
    mp4: 'file-video',
    mov: 'file-video',
    avi: 'file-video',
    mkv: 'file-video',
    webm: 'file-video',
    // audio
    mp3: 'file-audio',
    wav: 'file-audio',
    ogg: 'file-audio',
    flac: 'file-audio',
    m4a: 'file-audio',
    // archives
    zip: 'file-archive',
    tar: 'file-archive',
    gz: 'file-archive',
    tgz: 'file-archive',
    rar: 'file-archive',
    '7z': 'file-archive',
    // code
    js: 'file-code',
    ts: 'file-code',
    jsx: 'file-code',
    tsx: 'file-code',
    py: 'file-code',
    rb: 'file-code',
    go: 'file-code',
    rs: 'file-code',
    java: 'file-code',
    c: 'file-code',
    cpp: 'file-code',
    h: 'file-code',
    css: 'file-code',
    scss: 'file-code',
    html: 'file-code',
    yaml: 'file-code',
    yml: 'file-code',
    toml: 'file-code',
    xml: 'file-code',
    sh: 'file-terminal',
    json: 'file-json',
    // documents
    md: 'file-text',
    txt: 'file-text',
    rtf: 'file-text',
    pdf: 'file-text',
    doc: 'file-text',
    docx: 'file-text',
    // spreadsheets / decks
    csv: 'file-spreadsheet',
    xls: 'file-spreadsheet',
    xlsx: 'file-spreadsheet',
    ppt: 'presentation',
    pptx: 'presentation',
    // fonts
    ttf: 'file-type',
    otf: 'file-type',
    woff: 'file-type',
    woff2: 'file-type',
    // databases
    sql: 'database',
    db: 'database',
    sqlite: 'database',
}

// Pre-computed module-level icon constants (always rendered)
const fileIconHtml = lucideByName('file')
const menuIconHtml = lucideByName('ellipsis-vertical') || lucideByName('more-vertical')
const folderIconHtml = lucideByName('folder')
const plusIconHtml = lucideByName('plus')
const xIconHtml = lucideByName('x')

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
    private _categories: ExtendedSelectItem[] = []

    onNameChange: ((name: string) => void) | null = null
    onTagsChange: ((tagIds: string[]) => void) | null = null
    onMenuItemClick: ((key: string) => void) | null = null
    onCategoryChange: ((category: string) => void) | null = null
    onAction: (() => void) | null = null
    onItemsClick: ((items: number) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'readonly',
            'format',
            'extension',
            'name',
            'items',
            'size',
            'loading',
            'icon',
            'editable-tags',
            'category',
            'category-placeholder',
            'action-icon',
            'action-label',
        ]
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

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'category') {
            // Patch the embedded select in place — a full render would tear down
            // its open menu / focus mid-interaction.
            const sel = this.querySelector<ExtendedSelect>('tc-extended-select.tc-file-category')
            if (sel && sel.value !== (next ?? '')) sel.value = next ?? ''
            return
        }
        this._rerender()
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

    /** Explicit lucide icon name for the leading icon. Overrides the
     *  extension-derived icon. */
    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    /** When set (and not readonly), tag chips get remove buttons and a "+"
     *  trigger for adding tags from the `tags` definitions. */
    get editableTags(): boolean {
        return this.hasAttribute('editable-tags')
    }
    set editableTags(v: boolean) {
        if (v) this.setAttribute('editable-tags', '')
        else this.removeAttribute('editable-tags')
    }

    /** Selected category key — resolved against the `categories` items. */
    get category(): string | null {
        return this.getAttribute('category')
    }
    set category(v: string | null) {
        if (v != null) this.setAttribute('category', v)
        else this.removeAttribute('category')
    }

    get categoryPlaceholder(): string | null {
        return this.getAttribute('category-placeholder')
    }
    set categoryPlaceholder(v: string | null) {
        if (v != null) this.setAttribute('category-placeholder', v)
        else this.removeAttribute('category-placeholder')
    }

    /** Lucide icon name for the trailing action button. Absent → no button. */
    get actionIcon(): string | null {
        return this.getAttribute('action-icon')
    }
    set actionIcon(v: string | null) {
        if (v != null) this.setAttribute('action-icon', v)
        else this.removeAttribute('action-icon')
    }

    get actionLabel(): string | null {
        return this.getAttribute('action-label')
    }
    set actionLabel(v: string | null) {
        if (v != null) this.setAttribute('action-label', v)
        else this.removeAttribute('action-label')
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
                this._rerender()
            }
        }
    }

    /** Category options for the embedded tc-extended-select. Empty → no select. */
    get categories(): ExtendedSelectItem[] {
        return this._categories
    }
    set categories(v: ExtendedSelectItem[]) {
        const hadCategories = this._categories.length > 0
        this._categories = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (hadCategories === this._categories.length > 0) {
                // Select already in (or out of) the DOM — just push new items
                this._syncCategorySelect()
            } else {
                this._rerender()
            }
        }
    }

    // ── Private helpers ─────────────────────────────────────────────────────

    /** Structural re-render preserving an in-progress name edit. */
    private _rerender(): void {
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

    private _patchTags(): void {
        const tagsEl = this.querySelector<HTMLElement>('.tc-file-tags')
        if (tagsEl) {
            const chipList = tagsEl.querySelector<HTMLElement>('.tc-file-chip-list')
            if (chipList) {
                // Patch the chips in place and push new items/values into the
                // embedded select — rebuilding the select here would tear down
                // its open menu mid-interaction (same rule as the category
                // select in attributeChangedCallback).
                chipList.innerHTML = this._buildChipsHtml()
                this._wireChipRemoves(chipList)
                this._syncTagsSelect()
            } else {
                tagsEl.innerHTML = this._buildTagsAreaHtml()
                this._wireTagsArea(tagsEl)
            }
        }
        // Tags may appear/disappear via the property setters — keep the sub-row
        // visibility in sync without a structural re-render.
        const sub = this.querySelector<HTMLElement>('.tc-file-sub')
        if (sub) sub.classList.toggle('tc-file-sub--hidden', !this._subRowVisible())
    }

    /** The sub-row (category select + tags) renders under the name — hidden
     *  when it would be empty. */
    private _subRowVisible(): boolean {
        return this._categories.length > 0 || this._tagIds.length > 0 || this._tagsEditable()
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

    private _leadingIconHtml(): string {
        const explicit = this.getAttribute('icon')
        if (explicit) {
            const html = lucideByName(explicit)
            if (html) return html
        }
        const ext = (this.getAttribute('extension') ?? '').replace(/^\./, '').toLowerCase()
        const mapped = ext ? EXT_ICON_MAP[ext] : undefined
        if (mapped) {
            const html = lucideByName(mapped)
            if (html) return html
        }
        return fileIconHtml
    }

    private _tagsEditable(): boolean {
        return this.editableTags && !this.readonly
    }

    private _buildChipsHtml(): string {
        const editable = this._tagsEditable()
        const tagMap = new Map(this._tags.map((t) => [t.id, t]))
        return this._tagIds
            .flatMap((id) => {
                const tag = tagMap.get(id)
                if (!tag) return []
                const removeHtml = editable
                    ? `<button type="button" class="tc-file-chip-remove" data-tag-id="${esc(tag.id)}"` +
                      ` aria-label="Remove ${esc(tag.label)}">${xIconHtml}</button>`
                    : ''
                return [`<span class="tc-file-chip">${esc(tag.label)}${removeHtml}</span>`]
            })
            .join('')
    }

    private _buildTagsAreaHtml(): string {
        const chipsHtml = `<span class="tc-file-chip-list">${this._buildChipsHtml()}</span>`
        if (!this._tagsEditable()) return chipsHtml
        // The add dropdown IS the category dropdown: the same tc-extended-select
        // control in `multiple` mode. Search, keyboard handling, positioning and
        // theming all come from the shared component; CSS restyles only the
        // trigger into the compact "+" affordance.
        return (
            chipsHtml +
            `<tc-extended-select class="tc-file-tags-select" multiple` +
            ` placeholder="Add tag" search-placeholder="Search tags"></tc-extended-select>`
        )
    }

    private _wireTagsArea(tagsEl: HTMLElement): void {
        if (!this._tagsEditable()) return
        const chipList = tagsEl.querySelector<HTMLElement>('.tc-file-chip-list')
        if (chipList) this._wireChipRemoves(chipList)
        this._syncTagsSelect()
    }

    private _wireChipRemoves(chipList: HTMLElement): void {
        Array.from(chipList.querySelectorAll<HTMLButtonElement>('.tc-file-chip-remove')).forEach(
            (btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.tagId
                    if (id) this._commitTags(this._tagIds.filter((t) => t !== id))
                })
            },
        )
    }

    private _syncTagsSelect(): void {
        const sel = this.querySelector<ExtendedSelect>('tc-extended-select.tc-file-tags-select')
        if (!sel) return
        // Reassigning items resets the select's search query/scroll — only push
        // when the tag pool actually changed.
        const nextItems = this._tags.map((t) => ({ key: t.id, label: t.label }))
        const prevItems = sel.items
        const itemsChanged =
            prevItems.length !== nextItems.length ||
            nextItems.some((n, i) => prevItems[i]?.key !== n.key || prevItems[i]?.label !== n.label)
        if (itemsChanged) sel.items = nextItems
        if (sel.values.join(',') !== this._tagIds.join(',')) sel.values = this._tagIds
        sel.onChange = (value: string | string[]) => {
            const ids = Array.isArray(value) ? value : value ? [value] : []
            if (ids.join(',') === this._tagIds.join(',')) return
            this._commitTags(ids)
        }
        // The chevron caret slot carries the "+" glyph — with the trigger label
        // visually hidden it is the whole "add tag" affordance. Safe to swap:
        // the select only patches the label/list after mount, never the caret.
        const caret = sel.querySelector<HTMLElement>('.tc-extended-select__caret')
        if (caret) caret.innerHTML = plusIconHtml
    }

    private _commitTags(newIds: string[]): void {
        this._tagIds = newIds
        this._patchTags()
        this.dispatchEvent(
            new CustomEvent('tc-tags-change', {
                bubbles: true,
                composed: true,
                detail: { tagIds: newIds.slice() },
            }),
        )
        if (typeof this.onTagsChange === 'function') this.onTagsChange(newIds.slice())
    }

    private _syncCategorySelect(): void {
        const sel = this.querySelector<ExtendedSelect>('tc-extended-select.tc-file-category')
        if (!sel) return
        sel.items = this._categories
        sel.onChange = (value: string | string[]) => {
            const key = Array.isArray(value) ? (value[0] ?? '') : value
            if ((this.getAttribute('category') ?? '') === key) return
            // attributeChangedCallback('category') only patches the child value,
            // so no render loop occurs here.
            if (key) this.setAttribute('category', key)
            else this.removeAttribute('category')
            this.dispatchEvent(
                new CustomEvent('tc-category-change', {
                    bubbles: true,
                    composed: true,
                    detail: { category: key },
                }),
            )
            if (typeof this.onCategoryChange === 'function') this.onCategoryChange(key)
        }
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
            const wrap = this.querySelector<HTMLElement>('.tc-file-menu-wrap')
            if (!wrap || !wrap.contains(e.target as Node)) this._closeMenu(false)
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

        const categoryHtml = this._categories.length
            ? `<tc-extended-select class="tc-file-category"` +
              ` placeholder="${esc(this.categoryPlaceholder ?? 'Category')}"` +
              ` value="${esc(this.getAttribute('category') ?? '')}"` +
              `${readonly ? ' disabled' : ''}></tc-extended-select>`
            : ''

        const sizeHtml =
            sizeBytes > 0 ? `<span class="tc-file-size">${esc(formatBytes(sizeBytes))}</span>` : ''
        // Item count is a real button — clicking it fires tc-items-click (e.g.
        // to expand/open the container). Functional in readonly mode too.
        const itemsLabel = `${itemCount} item${itemCount !== 1 ? 's' : ''}`
        const itemsHtml =
            itemCount > 0
                ? `<button type="button" class="tc-file-items" aria-label="${itemsLabel}">` +
                  `<span class="tc-file-items-icon" aria-hidden="true">${folderIconHtml}</span>` +
                  `${itemCount}</button>`
                : ''
        const metaHtml =
            sizeHtml || itemsHtml ? `<div class="tc-file-meta">${itemsHtml}${sizeHtml}</div>` : ''

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

        const actionIconName = this.getAttribute('action-icon')
        const actionIconHtml = actionIconName ? lucideByName(actionIconName) : ''
        const actionHtml = actionIconHtml
            ? `<button type="button" class="tc-file-action"` +
              ` aria-label="${esc(this.getAttribute('action-label') ?? 'Action')}">${actionIconHtml}</button>`
            : ''

        // Two-line main column: name row on top, category + tags underneath.
        const subClass = 'tc-file-sub' + (this._subRowVisible() ? '' : ' tc-file-sub--hidden')
        const mainHtml =
            `<div class="tc-file-main">` +
            `<div class="tc-file-name-row">${formatBadgeHtml}${nameHtml}</div>` +
            `<div class="${subClass}">` +
            categoryHtml +
            `<div class="tc-file-tags">${this._buildTagsAreaHtml()}</div>` +
            `</div>` +
            `</div>`

        this.innerHTML =
            `<div class="${rowClass}">` +
            `<span class="tc-file-icon" aria-hidden="true">${this._leadingIconHtml()}</span>` +
            mainHtml +
            metaHtml +
            menuHtml +
            actionHtml +
            `</div>`

        this._syncCategorySelect()

        // Items count button — clickable in every mode.
        const itemsBtn = this.querySelector<HTMLButtonElement>('.tc-file-items')
        if (itemsBtn) {
            itemsBtn.addEventListener('click', () => {
                const count = this.items
                this.dispatchEvent(
                    new CustomEvent('tc-items-click', {
                        bubbles: true,
                        composed: true,
                        detail: { items: count },
                    }),
                )
                if (typeof this.onItemsClick === 'function') this.onItemsClick(count)
            })
        }

        // The trailing action button stays functional in readonly mode — it is
        // a view-level action (download, open, …), not an edit affordance.
        const actionBtn = this.querySelector<HTMLButtonElement>('.tc-file-action')
        if (actionBtn) {
            actionBtn.addEventListener('click', () => {
                this.dispatchEvent(
                    new CustomEvent('tc-action', { bubbles: true, composed: true, detail: {} }),
                )
                if (typeof this.onAction === 'function') this.onAction()
            })
        }

        // Wire event listeners after innerHTML replacement.
        if (!readonly) {
            const nameInput = this.querySelector<HTMLInputElement>('input.tc-file-name')
            if (nameInput) {
                nameInput.addEventListener('keydown', this._onNameKeydown)
                nameInput.addEventListener('blur', this._onNameBlur)
            }

            const tagsEl = this.querySelector<HTMLElement>('.tc-file-tags')
            if (tagsEl) this._wireTagsArea(tagsEl)

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
