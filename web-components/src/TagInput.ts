import { esc } from './internal/esc'
import { X, Check } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-tag-input'

// Unique-id source for combobox/listbox/label ARIA wiring across instances.
let _idCounter = 0

// Pre-compute at module load — these icons are always in the rendered HTML.
const xIconHtml = icon(X)
const checkIconHtml = icon(Check)

export class TagInput extends HTMLElement {
    private _initialised = false
    private _idPrefix = ''

    // Tag state
    private _internalTags: string[] = []
    private _value: string[] | undefined = undefined
    private _defaultValue: string[] = []
    private _recommendations: string[] = []

    // Interaction state
    private _input = ''
    private _open = false
    private _highlightIdx = -1

    private _outsideHandler: ((e: MouseEvent) => void) | null = null

    // Optional callback property (fires alongside the tc-change event).
    onchangetags: ((tags: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'placeholder', 'disabled', 'allow-create', 'max-tags', 'loading']
    }

    constructor() {
        super()
        this._idPrefix = `tc-tag-input-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachOutside()
    }

    disconnectedCallback(): void {
        this._detachOutside()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── Attribute getters/setters ─────────────────────────────────────────────

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Add a tag…'
    }
    set placeholder(v: string | null) {
        if (v != null) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get allowCreate(): boolean {
        return this.hasAttribute('allow-create')
    }
    set allowCreate(v: boolean) {
        if (v) this.setAttribute('allow-create', '')
        else this.removeAttribute('allow-create')
    }

    get maxTags(): number {
        const n = parseInt(this.getAttribute('max-tags') ?? '0', 10)
        return Number.isFinite(n) && n > 0 ? n : 0
    }
    set maxTags(v: number) {
        if (v && v > 0) this.setAttribute('max-tags', String(v))
        else this.removeAttribute('max-tags')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS property getters/setters ────────────────────────────────────────────

    get recommendations(): string[] {
        return this._recommendations
    }
    set recommendations(v: string[]) {
        this._recommendations = Array.isArray(v) ? [...v] : []
        if (this._initialised) this.render()
    }

    get value(): string[] | undefined {
        return this._value
    }
    set value(v: string[] | undefined) {
        // Setting an array places the component in controlled mode; the internal
        // tag list mirrors `value` on each set and is never self-mutated.
        this._value = Array.isArray(v) ? [...v] : undefined
        if (this._initialised) this.render()
    }

    get defaultValue(): string[] {
        return this._defaultValue
    }
    set defaultValue(v: string[]) {
        this._defaultValue = Array.isArray(v) ? [...v] : []
        // Seed the internal (uncontrolled) tag list from the default.
        if (!this._isControlled()) this._internalTags = [...this._defaultValue]
        if (this._initialised) this.render()
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private _isControlled(): boolean {
        return this._value !== undefined
    }

    private _getTags(): string[] {
        return this._isControlled() ? (this._value as string[]) : this._internalTags
    }

    private _atLimit(): boolean {
        const max = this.maxTags
        return max > 0 && this._getTags().length >= max
    }

    private _filtered(): string[] {
        const q = this._input.trim().toLowerCase()
        const tags = this._getTags()
        return this._recommendations.filter((r) => r.toLowerCase().includes(q) && !tags.includes(r))
    }

    private _showCreate(): boolean {
        const inp = this._input.trim()
        return (
            this.allowCreate &&
            inp !== '' &&
            !this._getTags().includes(inp) &&
            !this._recommendations.includes(inp)
        )
    }

    // ── Mutation ───────────────────────────────────────────────────────────────

    private _updateTags(next: string[]): void {
        if (!this._isControlled()) this._internalTags = next
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { tags: [...next] },
            }),
        )
        if (typeof this.onchangetags === 'function') this.onchangetags([...next])
    }

    private _addTag(tag: string): void {
        const t = tag.trim()
        const tags = this._getTags()
        if (!t || tags.includes(t) || this._atLimit()) return
        if (!this.allowCreate && !this._recommendations.includes(t)) return
        this._updateTags([...tags, t])
        this._input = ''
        this._highlightIdx = -1
        this._afterTagsChange(true)
    }

    private _removeTag(tag: string): void {
        const tags = this._getTags()
        this._updateTags(tags.filter((t) => t !== tag))
        this._afterTagsChange(false)
    }

    // Surgical refresh that preserves input focus after a tag add/remove.
    private _afterTagsChange(clearInput: boolean): void {
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        if (field && clearInput) field.value = ''
        this._patchChips()
        this._patchField()
        this._renderMenu()
        if (field && !this.disabled && !field.disabled) field.focus()
    }

    private _patchChips(): void {
        const control = this.querySelector<HTMLElement>('.tc-tag-input-control')
        if (!control) return
        const field = control.querySelector<HTMLInputElement>('.tc-tag-input-field')
        if (!field) return
        control.querySelectorAll('.tc-tag-input-tag').forEach((n) => n.remove())
        field.insertAdjacentHTML('beforebegin', this._buildChipsHtml())
    }

    private _patchField(): void {
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        const tags = this._getTags()
        const atLimit = this._atLimit()
        if (field) {
            field.disabled = this.disabled || atLimit
            field.placeholder = tags.length ? '' : this.placeholder
        }
        const max = this.maxTags
        const counter = this.querySelector<HTMLElement>('.tc-tag-input-counter')
        if (counter && max > 0) counter.textContent = `${tags.length}/${max}`
        const hint = this.querySelector<HTMLElement>('.tc-tag-input-hint')
        if (hint) hint.hidden = !atLimit
    }

    // ── Menu rendering ─────────────────────────────────────────────────────────

    private _buildChipsHtml(): string {
        const tags = this._getTags()
        const disabled = this.disabled
        return tags
            .map((tag) => {
                const removeBtn = !disabled
                    ? `<button type="button" class="tc-tag-input-remove" aria-label="Remove ${esc(tag)}" data-value="${esc(tag)}">${xIconHtml}</button>`
                    : ''
                return `<span class="tc-tag-input-tag">${esc(tag)}${removeBtn}</span>`
            })
            .join('')
    }

    private _buildMenuHtml(): string {
        const filtered = this._filtered()
        const showCreate = this._showCreate()
        const p = this._idPrefix
        let html = ''
        filtered.forEach((tag, i) => {
            const active = i === this._highlightIdx
            html +=
                `<li id="${p}-opt-${i}" role="option" aria-selected="${active}"` +
                ` class="tc-tag-input-menu-item${active ? ' tc-tag-input-menu-item--active' : ''}"` +
                ` data-idx="${i}" data-value="${esc(tag)}">` +
                `<span class="tc-tag-input-menu-label">${esc(tag)}</span>` +
                `<span class="tc-tag-input-menu-check">${checkIconHtml}</span></li>`
        })
        if (showCreate) {
            const i = filtered.length
            const active = i === this._highlightIdx
            html +=
                `<li id="${p}-opt-${i}" role="option" aria-selected="${active}"` +
                ` class="tc-tag-input-menu-item tc-tag-input-menu-item--create${active ? ' tc-tag-input-menu-item--active' : ''}"` +
                ` data-idx="${i}" data-create="1">` +
                `<span class="tc-tag-input-menu-label">Create &quot;<strong>${esc(this._input.trim())}</strong>&quot;</span>` +
                `<span class="tc-tag-input-menu-check">${checkIconHtml}</span></li>`
        }
        return html
    }

    private _renderMenu(): void {
        const menu = this.querySelector<HTMLElement>('.tc-tag-input-menu')
        if (!menu) return
        menu.innerHTML = this._buildMenuHtml()
        const total = this._filtered().length + (this._showCreate() ? 1 : 0)
        const show = this._open && total > 0 && !this.disabled
        menu.classList.toggle('tc-tag-input-menu--open', show)
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        if (field) field.setAttribute('aria-expanded', show ? 'true' : 'false')
        this._patchHighlight()
    }

    private _patchHighlight(): void {
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        const items = Array.from(this.querySelectorAll<HTMLElement>('.tc-tag-input-menu-item'))
        items.forEach((el, i) => {
            const active = i === this._highlightIdx
            el.classList.toggle('tc-tag-input-menu-item--active', active)
            el.setAttribute('aria-selected', active ? 'true' : 'false')
        })
        if (field) {
            if (this._highlightIdx >= 0 && items[this._highlightIdx]) {
                field.setAttribute('aria-activedescendant', items[this._highlightIdx].id)
                items[this._highlightIdx].scrollIntoView({ block: 'nearest' })
            } else {
                field.removeAttribute('aria-activedescendant')
            }
        }
    }

    private _closeMenu(): void {
        this._open = false
        this._highlightIdx = -1
        this._renderMenu()
    }

    // ── Document outside-click ─────────────────────────────────────────────────

    private _attachOutside(): void {
        this._outsideHandler = (e: MouseEvent) => {
            if (this._open && !this.contains(e.target as Node)) this._closeMenu()
        }
        document.addEventListener('mousedown', this._outsideHandler)
    }

    private _detachOutside(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
        const p = this._idPrefix
        const label = this.label
        const labelHtml = label
            ? `<label class="tc-tag-input-label" id="${p}-label" for="${p}-input">${esc(label)}</label>`
            : ''

        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            this.innerHTML =
                `<div class="tc-tag-input tc-tag-input--loading">` +
                labelHtml +
                `<div class="tc-tag-input-wrap">` +
                `<div class="tc-tag-input-control tc-tag-input-skeleton" aria-hidden="true"></div>` +
                `</div>` +
                `<span class="visually-hidden">Loading…</span>` +
                `</div>`
            return
        }
        this.removeAttribute('role')
        this.removeAttribute('aria-busy')

        const disabled = this.disabled
        const tags = this._getTags()
        const fieldDisabled = disabled || this._atLimit()
        const placeholderAttr = tags.length ? '' : this.placeholder
        const max = this.maxTags

        const labelRef = label ? `aria-labelledby="${p}-label"` : `aria-label="Tag input"`

        const fieldHtml =
            `<input class="tc-tag-input-field" id="${p}-input" type="text" role="combobox"` +
            ` autocomplete="off" aria-autocomplete="list" aria-expanded="false"` +
            ` aria-controls="${p}-menu" ${labelRef}` +
            ` placeholder="${esc(placeholderAttr)}"${fieldDisabled ? ' disabled' : ''} />`

        const counterHtml =
            max > 0
                ? `<span class="tc-tag-input-counter" aria-live="polite">${tags.length}/${max}</span>`
                : ''
        const hintHidden = !this._atLimit()
        const hintHtml =
            max > 0
                ? `<span class="tc-tag-input-hint" role="status"${hintHidden ? ' hidden' : ''}>Tag limit reached</span>`
                : ''

        const menuLabel = label ? `aria-labelledby="${p}-label"` : `aria-label="Tag suggestions"`

        this.innerHTML =
            `<div class="tc-tag-input${disabled ? ' tc-tag-input--disabled' : ''}">` +
            labelHtml +
            `<div class="tc-tag-input-wrap">` +
            `<div class="tc-tag-input-control">${this._buildChipsHtml()}${fieldHtml}</div>` +
            `<ul class="tc-tag-input-menu" id="${p}-menu" role="listbox" ${menuLabel}></ul>` +
            `</div>` +
            (counterHtml || hintHtml
                ? `<div class="tc-tag-input-meta">${counterHtml}${hintHtml}</div>`
                : '') +
            `</div>`

        this._wireListeners()
        this._renderMenu()
    }

    private _wireListeners(): void {
        if (this.disabled) return

        const control = this.querySelector<HTMLElement>('.tc-tag-input-control')
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        const menu = this.querySelector<HTMLElement>('.tc-tag-input-menu')

        // Click on the control: focus the field and open the menu. Remove-button
        // clicks are intercepted first and do not bubble to an open.
        if (control) {
            control.addEventListener('click', (e: MouseEvent) => {
                const removeBtn = (e.target as Element).closest<HTMLButtonElement>(
                    '.tc-tag-input-remove',
                )
                if (removeBtn) {
                    e.stopPropagation()
                    const v = removeBtn.dataset.value
                    if (v != null) this._removeTag(v)
                    return
                }
                if (field && !field.disabled) field.focus()
                this._open = true
                this._renderMenu()
            })
        }

        if (field) {
            field.addEventListener('input', () => {
                this._input = field.value
                this._highlightIdx = -1
                this._open = true
                this._renderMenu()
            })

            field.addEventListener('focus', () => {
                this._open = true
                this._renderMenu()
            })

            field.addEventListener('keydown', (e: KeyboardEvent) => {
                if (this.disabled) return
                const filtered = this._filtered()
                const showCreate = this._showCreate()
                const total = filtered.length + (showCreate ? 1 : 0)

                if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    if (total > 0) {
                        this._open = true
                        this._highlightIdx = (this._highlightIdx + 1) % total
                        this._renderMenu()
                    }
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    if (total > 0) {
                        this._open = true
                        this._highlightIdx =
                            this._highlightIdx <= 0 ? total - 1 : this._highlightIdx - 1
                        this._renderMenu()
                    }
                } else if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    if (this._highlightIdx >= 0 && this._highlightIdx < filtered.length) {
                        this._addTag(filtered[this._highlightIdx])
                    } else if (this._highlightIdx === filtered.length && showCreate) {
                        this._addTag(this._input.trim())
                    } else if (this._input.trim()) {
                        this._addTag(this._input.trim())
                    }
                } else if (e.key === 'Escape') {
                    this._closeMenu()
                } else if (e.key === 'Backspace' && !this._input && this._getTags().length) {
                    e.preventDefault()
                    const cur = this._getTags()
                    this._removeTag(cur[cur.length - 1])
                }
            })

            field.addEventListener('paste', (e: ClipboardEvent) => {
                const text = e.clipboardData?.getData('text') ?? ''
                if (!text.includes(',')) return
                e.preventDefault()
                const parts = text
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                const max = this.maxTags
                const next = [...this._getTags()]
                for (const part of parts) {
                    if (next.includes(part)) continue
                    if (max > 0 && next.length >= max) break
                    if (this.allowCreate || this._recommendations.includes(part)) next.push(part)
                }
                this._updateTags(next)
                this._input = ''
                this._highlightIdx = -1
                this._afterTagsChange(true)
            })
        }

        if (menu) {
            // mousedown (not click) so the field keeps focus while selecting.
            menu.addEventListener('mousedown', (e: MouseEvent) => {
                const li = (e.target as Element).closest<HTMLElement>('.tc-tag-input-menu-item')
                if (!li) return
                e.preventDefault()
                if (li.dataset.create) this._addTag(this._input.trim())
                else if (li.dataset.value != null) this._addTag(li.dataset.value)
            })

            menu.addEventListener('mouseover', (e: MouseEvent) => {
                const li = (e.target as Element).closest<HTMLElement>('.tc-tag-input-menu-item')
                if (!li) return
                const idx = parseInt(li.dataset.idx ?? '', 10)
                if (Number.isFinite(idx) && idx !== this._highlightIdx) {
                    this._highlightIdx = idx
                    this._patchHighlight()
                }
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TagInput
    }
}
