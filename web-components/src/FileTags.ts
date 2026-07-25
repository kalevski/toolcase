import { esc } from './internal/esc'
import { Plus, X } from 'lucide-static'
import { icon } from './icons'
// Re-uses the canonical FileTag shape owned by tc-file so both file ports agree.
import type { FileTag } from './File'

const TAG_NAME = 'tc-file-tags'

// Pre-compute at module load — these icons are always in the rendered HTML
const plusIconHtml = icon(Plus)
const xIconHtml = icon(X)

export class FileTags extends HTMLElement {
    private _initialised = false
    private _tags: FileTag[] = []
    private _selectedIds: string[] = []
    private _isMenuOpen = false
    private _activeOptionIdx = -1
    private _menuOutsideHandler: ((e: MouseEvent) => void) | null = null
    private _menuKeyHandler: ((e: KeyboardEvent) => void) | null = null

    onChange: ((selectedIds: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['readonly']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeMenuHandlers()
        this._isMenuOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
    }

    // ── Attribute getters/setters ─────────────────────────────────────────

    get readonly(): boolean {
        return this.hasAttribute('readonly')
    }
    set readonly(v: boolean) {
        if (v) this.setAttribute('readonly', '')
        else this.removeAttribute('readonly')
    }

    // ── JS property getters/setters ────────────────────────────────────────

    get tags(): FileTag[] {
        return this._tags
    }
    set tags(v: FileTag[]) {
        this._tags = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isMenuOpen) this._closeMenu(false)
            this.render()
        }
    }

    get selectedIds(): string[] {
        return this._selectedIds
    }
    set selectedIds(v: string[]) {
        this._selectedIds = Array.isArray(v) ? v : []
        if (this._initialised) {
            if (this._isMenuOpen) this._closeMenu(false)
            this.render()
        }
    }

    // ── Private helpers ────────────────────────────────────────────────────

    private _getUnselectedTags(filter: string): FileTag[] {
        const sel = new Set(this._selectedIds)
        const lf = filter.toLowerCase()
        return this._tags.filter((t) => {
            if (sel.has(t.id)) return false
            if (!filter) return true
            return t.label.toLowerCase().includes(lf)
        })
    }

    private _openMenu(): void {
        if (this._isMenuOpen) return
        this._isMenuOpen = true
        this._activeOptionIdx = -1

        const trigger = this.querySelector<HTMLButtonElement>('.tc-file-tags-add')
        const menu = this.querySelector<HTMLElement>('.tc-file-tags-menu')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menu) menu.classList.add('tc-file-tags-menu--open')

        const searchInput = this.querySelector<HTMLInputElement>('.tc-file-tags-search')
        if (searchInput) {
            searchInput.value = ''
            requestAnimationFrame(() => searchInput.focus())
        }

        this._menuOutsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu()
        }
        document.addEventListener('mousedown', this._menuOutsideHandler)

        this._menuKeyHandler = this._onMenuKeydown
        document.addEventListener('keydown', this._menuKeyHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isMenuOpen) return
        this._isMenuOpen = false
        this._activeOptionIdx = -1

        const trigger = this.querySelector<HTMLButtonElement>('.tc-file-tags-add')
        const menu = this.querySelector<HTMLElement>('.tc-file-tags-menu')
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menu) {
            menu.classList.remove('tc-file-tags-menu--open')
            const searchInput = menu.querySelector<HTMLInputElement>('.tc-file-tags-search')
            if (searchInput) searchInput.value = ''
            const listEl = menu.querySelector<HTMLElement>('.tc-file-tags-options')
            if (listEl) listEl.innerHTML = this._buildOptionsHtml('')
        }

        this._removeMenuHandlers()
        if (refocus && trigger) trigger.focus()
    }

    private _removeMenuHandlers(): void {
        if (this._menuOutsideHandler) {
            document.removeEventListener('mousedown', this._menuOutsideHandler)
            this._menuOutsideHandler = null
        }
        if (this._menuKeyHandler) {
            document.removeEventListener('keydown', this._menuKeyHandler)
            this._menuKeyHandler = null
        }
    }

    private _buildOptionsHtml(filter: string): string {
        const unselected = this._getUnselectedTags(filter)
        if (!unselected.length) {
            return `<div class="tc-file-tags-no-results">No tags found</div>`
        }
        return unselected
            .map((t, idx) => {
                const activeCls =
                    idx === this._activeOptionIdx ? ' tc-file-tags-option--active' : ''
                return (
                    `<div class="tc-file-tags-option${activeCls}" role="option" aria-selected="false"` +
                    ` tabindex="-1" data-id="${esc(t.id)}">${esc(t.label)}</div>`
                )
            })
            .join('')
    }

    private _renderMenuOptions(filter: string): void {
        const listEl = this.querySelector<HTMLElement>('.tc-file-tags-options')
        if (listEl) listEl.innerHTML = this._buildOptionsHtml(filter)
    }

    private _highlightOption(): void {
        const options = Array.from(this.querySelectorAll<HTMLElement>('.tc-file-tags-option'))
        options.forEach((opt, idx) => {
            opt.classList.toggle('tc-file-tags-option--active', idx === this._activeOptionIdx)
        })
        if (this._activeOptionIdx >= 0 && options[this._activeOptionIdx]) {
            options[this._activeOptionIdx].focus()
        } else {
            const searchInput = this.querySelector<HTMLInputElement>('.tc-file-tags-search')
            if (searchInput) searchInput.focus()
        }
    }

    private _onMenuKeydown = (e: KeyboardEvent): void => {
        if (!this._isMenuOpen) return

        const options = Array.from(this.querySelectorAll<HTMLElement>('.tc-file-tags-option'))
        const len = options.length

        if (e.key === 'Escape') {
            e.preventDefault()
            this._closeMenu()
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            this._activeOptionIdx = len > 0 ? Math.min(this._activeOptionIdx + 1, len - 1) : -1
            this._highlightOption()
            return
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault()
            this._activeOptionIdx = Math.max(this._activeOptionIdx - 1, -1)
            this._highlightOption()
            return
        }

        if (e.key === 'Enter') {
            e.preventDefault()
            if (this._activeOptionIdx >= 0 && this._activeOptionIdx < len) {
                const id = options[this._activeOptionIdx].dataset.id
                if (id) this._selectTag(id)
            }
            return
        }

        if (e.key === 'Tab') {
            this._closeMenu()
        }
    }

    private _selectTag(id: string): void {
        if (this._selectedIds.includes(id)) return
        this._selectedIds = [...this._selectedIds, id]
        this._emit()
        // Surgical patch: keep menu open with current search filter
        this._activeOptionIdx = -1
        const chipsEl = this.querySelector<HTMLElement>('.tc-file-tags-chips')
        if (chipsEl) chipsEl.innerHTML = this._buildChipsHtml()
        const searchInput = this.querySelector<HTMLInputElement>('.tc-file-tags-search')
        this._renderMenuOptions(searchInput?.value ?? '')
    }

    private _deselectTag(id: string): void {
        this._selectedIds = this._selectedIds.filter((s) => s !== id)
        this._emit()
        const chipsEl = this.querySelector<HTMLElement>('.tc-file-tags-chips')
        if (chipsEl) chipsEl.innerHTML = this._buildChipsHtml()
        if (this._isMenuOpen) {
            const searchInput = this.querySelector<HTMLInputElement>('.tc-file-tags-search')
            this._renderMenuOptions(searchInput?.value ?? '')
        }
    }

    private _emit(): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { selectedIds: [...this._selectedIds] },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange([...this._selectedIds])
    }

    private _buildChipsHtml(): string {
        const tagMap = new Map(this._tags.map((t) => [t.id, t]))
        const readonly = this.readonly

        return this._selectedIds
            .flatMap((id) => {
                const tag = tagMap.get(id)
                if (!tag) return []
                const colorStyle = tag.color
                    ? ` style="--bs-file-tags-chip-color:${esc(tag.color)}"`
                    : ''
                const removeBtn = !readonly
                    ? `<button type="button" class="tc-file-tags-chip-remove" aria-label="Remove ${esc(tag.label)}">${xIconHtml}</button>`
                    : ''
                return [
                    `<span class="tc-file-tags-chip" data-id="${esc(id)}"${colorStyle}>${esc(tag.label)}${removeBtn}</span>`,
                ]
            })
            .join('')
    }

    private render(): void {
        const chipsHtml = this._buildChipsHtml()
        const optionsHtml = this._buildOptionsHtml('')

        const addControlHtml = !this.readonly
            ? `<div class="tc-file-tags-add-wrap">` +
              `<button type="button" class="tc-file-tags-add" aria-haspopup="listbox" aria-expanded="false">` +
              `${plusIconHtml}<span>Add tag</span></button>` +
              `<div class="tc-file-tags-menu" role="listbox" aria-label="Available tags">` +
              `<input type="text" class="tc-file-tags-search" placeholder="Search tags…"` +
              ` autocomplete="off" aria-label="Search tags" />` +
              `<div class="tc-file-tags-options">${optionsHtml}</div>` +
              `</div></div>`
            : ''

        this.innerHTML =
            `<div class="tc-file-tags">` +
            `<div class="tc-file-tags-chips">${chipsHtml}</div>` +
            addControlHtml +
            `</div>`

        // ── Chip remove: delegated on chips container ───────────────────────
        const chipsEl = this.querySelector<HTMLElement>('.tc-file-tags-chips')
        if (chipsEl) {
            chipsEl.addEventListener('click', (e: MouseEvent) => {
                const btn = (e.target as Element).closest<HTMLButtonElement>(
                    '.tc-file-tags-chip-remove',
                )
                if (!btn) return
                const chip = btn.closest<HTMLElement>('.tc-file-tags-chip')
                const id = chip?.dataset.id
                if (id) this._deselectTag(id)
            })
        }

        if (!this.readonly) {
            // ── Add button ────────────────────────────────────────────────────
            const addBtn = this.querySelector<HTMLButtonElement>('.tc-file-tags-add')
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    if (this._isMenuOpen) this._closeMenu()
                    else this._openMenu()
                })
                addBtn.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault()
                        if (!this._isMenuOpen) this._openMenu()
                    }
                })
            }

            // ── Search input ──────────────────────────────────────────────────
            const searchInput = this.querySelector<HTMLInputElement>('.tc-file-tags-search')
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    this._activeOptionIdx = -1
                    this._renderMenuOptions(searchInput.value)
                })
            }

            // ── Options click: delegated on options container ─────────────────
            const optionsEl = this.querySelector<HTMLElement>('.tc-file-tags-options')
            if (optionsEl) {
                optionsEl.addEventListener('click', (e: MouseEvent) => {
                    const option = (e.target as Element).closest<HTMLElement>(
                        '.tc-file-tags-option',
                    )
                    if (option?.dataset.id) this._selectTag(option.dataset.id)
                })
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FileTags
    }
}
