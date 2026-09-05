import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fixedOriginOffset } from './internal/containingBlock'
import { cssLength } from './internal/cssLength'
import { X, Check } from 'lucide-static'
import { icon } from './icons'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'

const TAG_NAME = 'tc-tag-input'

export type TagInputState = 'valid' | 'invalid'

const STATES: TagInputState[] = ['valid', 'invalid']

// Unique-id source for combobox/listbox/label ARIA wiring across instances.
let _idCounter = 0

// Pre-compute at module load — these icons are always in the rendered HTML.
const xIconHtml = icon(X)
const checkIconHtml = icon(Check)

export class TagInput extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _idPrefix = ''
    private _helpId = ''

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
    private _repositionHandler: (() => void) | null = null
    private _internals: ElementInternals

    // Optional callback property (fires alongside the tc-change event).
    onchangetags: ((tags: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'label',
            'name',
            'placeholder',
            'disabled',
            'required',
            'allow-create',
            'max-tags',
            'loading',
            'max-height',
            'help',
            'error',
            'state',
        ]
    }

    constructor() {
        super()
        this._idPrefix = `tc-tag-input-${++_idCounter}`
        // Stable id for the reserved message slot (field aria-describedby).
        this._helpId = `${this._idPrefix}-help`
        this._internals = this.attachInternals()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Seed the uncontrolled default from any attribute-less initial tags
            // already present in _internalTags (set via defaultValue before
            // connect); the array shape is the field's reset baseline.
            this._defaultValue = [...this._getTags()]
            this.render()
            this._initialised = true
        }
        this._applyMaxHeight()
        this._attachOutside()
        this._syncForm()
    }

    disconnectedCallback(): void {
        this._detachOutside()
        if (this._repositionHandler) {
            window.removeEventListener('scroll', this._repositionHandler, true)
            window.removeEventListener('resize', this._repositionHandler)
            this._repositionHandler = null
        }
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'max-height') {
            this._applyMaxHeight()
            return
        }
        // `name`/`required` affect form participation/validity only, not the open
        // suggestion menu, so reflect them into the form without a full render()
        // that would drop the menu's anchoring/focus. `required` also toggles the
        // field's aria-required in place.
        if (name === 'name') {
            this._syncForm()
            return
        }
        if (name === 'required') {
            const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
            if (field) {
                if (this.required) field.setAttribute('aria-required', 'true')
                else field.removeAttribute('aria-required')
            }
            this._patchRequiredMark()
            this._syncForm()
            return
        }
        // Validation-only attributes patch the reserved slot and the control's
        // invalid border in place. A full render() would tear down and rebuild
        // an open suggestion menu, dropping its anchoring and the field's focus.
        if (name === 'help' || name === 'error' || name === 'state') {
            this._patchValidation()
            // error/state change the effective validity → reflect into the form.
            this._syncForm()
            return
        }
        this.render()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        // Reset restores the default tag list (uncontrolled) — a controlled
        // component owns its value externally, so leave _value alone there.
        if (!this._isControlled()) this._internalTags = [...this._defaultValue]
        this.render()
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /**
     * Push value + validity into the form. The tags array is serialized one
     * entry per tag under `name` (setFieldFormValue handles the array shape).
     * Effective invalid = error / state invalid / required-but-empty (length 0).
     */
    private _syncForm(): void {
        const tags = this._getTags()
        // Pass the array straight through — the helper appends one entry per tag
        // under `name`, or submits nothing when the array is empty.
        setFieldFormValue(this._internals, this.name, tags.length ? tags : null)
        const error = this.error
        const requiredEmpty = this.required && tags.length === 0
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message:
                error || (requiredEmpty ? 'Please add at least one tag.' : msg('fieldInvalid')),
            anchor: this.querySelector<HTMLInputElement>('.tc-tag-input-field') ?? undefined,
        })
    }

    /**
     * Insert / remove the required asterisk on the label in place, without a
     * full re-render (which would drop an open menu). No-op when there's no
     * label element.
     */
    private _patchRequiredMark(): void {
        const labelEl = this.querySelector<HTMLLabelElement>('.tc-tag-input-label')
        if (!labelEl) return
        const existing = labelEl.querySelector('.tc-field-required')
        if (this.required && !existing) labelEl.insertAdjacentHTML('beforeend', requiredMark(true))
        else if (!this.required && existing) existing.remove()
    }

    /**
     * Cap how tall the suggestion menu grows before it scrolls. A bare number is
     * read as pixels; any CSS length (`50vh`, `20rem`, …) is honoured as-is.
     * Removing the attribute restores the stylesheet default (220px).
     */
    private _applyMaxHeight(): void {
        const h = cssLength(this.getAttribute('max-height'))
        if (h) this.style.setProperty('--bs-tag-input-menu-max-height', h)
        else this.style.removeProperty('--bs-tag-input-menu-max-height')
    }

    // ── Attribute getters/setters ─────────────────────────────────────────────

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    // ── name (form field name) ───────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
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

    // ── required ─────────────────────────────────────────────────────────────
    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
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

    get maxHeight(): string {
        return this.getAttribute('max-height') ?? ''
    }
    set maxHeight(v: string) {
        if (v) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    get state(): TagInputState | null {
        const v = this.getAttribute('state') as TagInputState
        return STATES.includes(v) ? v : null
    }
    set state(v: TagInputState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
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
        if (this._initialised) {
            this.render()
            // A programmatic value change must reflect into the form too.
            this._syncForm()
        }
    }

    get defaultValue(): string[] {
        return this._defaultValue
    }
    set defaultValue(v: string[]) {
        this._defaultValue = Array.isArray(v) ? [...v] : []
        // Seed the internal (uncontrolled) tag list from the default.
        if (!this._isControlled()) this._internalTags = [...this._defaultValue]
        if (this._initialised) {
            this.render()
            this._syncForm()
        }
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
        const tagSet = new Set(this._getTags())
        return this._recommendations.filter((r) => r.toLowerCase().includes(q) && !tagSet.has(r))
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
        // Reflect the new tag list into the form before announcing it.
        this._syncForm()
        // Canonical change event — detail is exactly { value }, carrying the tag
        // array (replaces the legacy { tags } shape).
        dispatchFieldChange(this, [...next])
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
        const wasOpen = menu.classList.contains('tc-tag-input-menu--open')
        const show = this._open && total > 0 && !this.disabled
        menu.classList.toggle('tc-tag-input-menu--open', show)
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        if (field) field.setAttribute('aria-expanded', show ? 'true' : 'false')
        this._patchHighlight()

        if (show && !wasOpen) {
            // Anchor the fixed-positioned menu to the trigger (escapes overflow
            // clipping from ancestor scroll containers), then keep it anchored
            // while the page or an ancestor scrolls/resizes underneath it.
            this._positionMenu()
            this._repositionHandler = () => this._positionMenu()
            window.addEventListener('scroll', this._repositionHandler, true)
            window.addEventListener('resize', this._repositionHandler)
        } else if (!show && wasOpen) {
            if (this._repositionHandler) {
                window.removeEventListener('scroll', this._repositionHandler, true)
                window.removeEventListener('resize', this._repositionHandler)
                this._repositionHandler = null
            }
        } else if (show) {
            // Filtering as the user types changes the menu height; re-anchor so
            // a flipped-up menu stays attached to the control instead of drifting.
            this._positionMenu()
        }
    }

    /**
     * Position the fixed menu against the control wrap in viewport coordinates.
     * Width matches the wrap; the menu opens below by default and flips above
     * when there isn't room beneath it. Left/top are clamped so the panel never
     * spills off-screen.
     */
    private _positionMenu(): void {
        const menu = this.querySelector<HTMLElement>('.tc-tag-input-menu')
        const anchor = this.querySelector<HTMLElement>('.tc-tag-input-wrap')
        if (!menu || !anchor) return

        const gap = 2
        const margin = 4
        const r = anchor.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        menu.style.width = `${r.width}px`

        const menuH = menu.offsetHeight
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < menuH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - menuH - gap)
            : Math.min(r.bottom + gap, vh - menuH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - r.width - margin))
        top = Math.max(margin, top)

        // Re-base onto the containing block when a transformed/filtered ancestor
        // has hijacked `position: fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        top -= o.y
        left -= o.x

        menu.style.top = `${top}px`
        menu.style.left = `${left}px`
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

    // Effective validity: a non-empty `error` forces invalid, else honour `state`.
    private _effectiveState(): TagInputState | null {
        return this.error ? 'invalid' : this.state
    }

    // Build the reserved message slot. The counter/limit-hint live in their own
    // `.tc-tag-input-meta` row and are unaffected — this slot only carries the
    // error / help / valid line, with invalid > valid > hint precedence.
    private _messageHtml(): string {
        return fieldMessageHtml({
            id: this._helpId,
            state: this._effectiveState(),
            error: this.error,
            hint: this.help,
            validText: 'Looks good!',
        })
    }

    private render(): void {
        const p = this._idPrefix
        const required = this.required
        const label = this.label
        const labelHtml = label
            ? `<label class="tc-tag-input-label" id="${p}-label" for="${p}-input">${esc(label)}${requiredMark(required)}</label>`
            : ''

        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            patchHtml(
                this,
                `<div class="tc-tag-input tc-tag-input--loading">` +
                    labelHtml +
                    `<div class="tc-tag-input-wrap">` +
                    `<div class="tc-tag-input-control tc-tag-input-skeleton" aria-hidden="true"></div>` +
                    `</div>` +
                    // Reserve the message line even while loading so the field's
                    // height does not jump when the skeleton resolves.
                    this._messageHtml() +
                    `<span class="visually-hidden">${esc(msg('loading'))}</span>` +
                    `</div>`,
            )
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

        // An `error` message forces invalid; otherwise honour `state`.
        const state = this._effectiveState()
        const invalidCls = state === 'invalid' ? ' tc-tag-input-control--invalid' : ''
        // Describe the field by the reserved slot only when it carries content.
        const describe = this.help || state ? ` aria-describedby="${this._helpId}"` : ''
        // aria-required surfaces the requirement on the focusable text field.
        const requiredAttr = required ? ' aria-required="true"' : ''

        const fieldHtml =
            `<input class="tc-tag-input-field" id="${p}-input" type="text" role="combobox"` +
            ` autocomplete="off" aria-autocomplete="list" aria-expanded="false"` +
            ` aria-controls="${p}-menu" ${labelRef}${describe}${requiredAttr}` +
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

        patchHtml(
            this,
            `<div class="tc-tag-input${disabled ? ' tc-tag-input--disabled' : ''}">` +
                labelHtml +
                `<div class="tc-tag-input-wrap">` +
                `<div class="tc-tag-input-control${invalidCls}">${this._buildChipsHtml()}${fieldHtml}</div>` +
                `<ul class="tc-tag-input-menu" id="${p}-menu" role="listbox" ${menuLabel}></ul>` +
                `</div>` +
                (counterHtml || hintHtml
                    ? `<div class="tc-tag-input-meta">${counterHtml}${hintHtml}</div>`
                    : '') +
                // Reserved message slot — LAST child of the host, after the control,
                // the (fixed-positioned) menu, and the counter/hint meta row. Plain
                // block flow, never inside the menu, so it stays visible and reserves
                // its line of height regardless of the menu's open/anchored state.
                this._messageHtml() +
                `</div>`,
        )

        this._wireListeners()
        this._renderMenu()
    }

    /**
     * Patch the reserved message slot, the control's invalid border, and the
     * field's aria-describedby in place — leaving the chips, the field's value,
     * and any open/anchored suggestion menu untouched.
     */
    private _patchValidation(): void {
        const state = this._effectiveState()

        const slot = this.querySelector<HTMLElement>('.tc-field-message')
        if (slot) slot.outerHTML = this._messageHtml()

        const control = this.querySelector<HTMLElement>('.tc-tag-input-control')
        if (control) control.classList.toggle('tc-tag-input-control--invalid', state === 'invalid')

        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        if (field) {
            if (this.help || state) field.setAttribute('aria-describedby', this._helpId)
            else field.removeAttribute('aria-describedby')
        }
    }

    private _wireListeners(): void {
        if (this.disabled) return

        const control = this.querySelector<HTMLElement>('.tc-tag-input-control')
        const field = this.querySelector<HTMLInputElement>('.tc-tag-input-field')
        const menu = this.querySelector<HTMLElement>('.tc-tag-input-menu')

        // Click on the control: focus the field and open the menu. Remove-button
        // clicks are intercepted first and do not bubble to an open.
        if (control) {
            bindOnce(control, 'click', (e: MouseEvent) => {
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
            bindOnce(field, 'input', () => {
                this._input = field.value
                this._highlightIdx = -1
                this._open = true
                this._renderMenu()
            })

            bindOnce(field, 'focus', () => {
                this._open = true
                this._renderMenu()
            })

            bindOnce(field, 'keydown', (e: KeyboardEvent) => {
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

            bindOnce(field, 'paste', (e: ClipboardEvent) => {
                const text = e.clipboardData?.getData('text') ?? ''
                if (!text.includes(',')) return
                e.preventDefault()
                const parts = text
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
                const max = this.maxTags
                const next = [...this._getTags()]
                const nextSet = new Set(next)
                const recommended = new Set(this._recommendations)
                for (const part of parts) {
                    if (nextSet.has(part)) continue
                    if (max > 0 && next.length >= max) break
                    if (this.allowCreate || recommended.has(part)) {
                        next.push(part)
                        nextSet.add(part)
                    }
                }
                this._updateTags(next)
                this._input = ''
                this._highlightIdx = -1
                this._afterTagsChange(true)
            })
        }

        if (menu) {
            // mousedown (not click) so the field keeps focus while selecting.
            bindOnce(menu, 'mousedown', (e: MouseEvent) => {
                const li = (e.target as Element).closest<HTMLElement>('.tc-tag-input-menu-item')
                if (!li) return
                e.preventDefault()
                if (li.dataset.create) this._addTag(this._input.trim())
                else if (li.dataset.value != null) this._addTag(li.dataset.value)
            })

            bindOnce(menu, 'mouseover', (e: MouseEvent) => {
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
