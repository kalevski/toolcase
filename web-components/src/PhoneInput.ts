import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { msg } from './messages'
import { fieldMessageHtml } from './internal/field-message'
import {
    requiredMark,
    setFieldFormValue,
    reflectFieldValidity,
    dispatchFieldChange,
} from './internal/form-field'
import { fixedOriginOffset } from './internal/containingBlock'
import { cssLength } from './internal/cssLength'
import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-phone-input'

let _idCounter = 0

export type PhoneInputState = 'valid' | 'invalid'
const STATES: PhoneInputState[] = ['valid', 'invalid']

function flagEmoji(code: string): string {
    return Array.from(code.toUpperCase())
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join('')
}

export interface PhoneCountry {
    code: string
    name: string
    dialCode: string
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: 'US', name: 'United States', dialCode: '+1' },
    { code: 'CA', name: 'Canada', dialCode: '+1' },
    { code: 'GB', name: 'United Kingdom', dialCode: '+44' },
    { code: 'AU', name: 'Australia', dialCode: '+61' },
    { code: 'DE', name: 'Germany', dialCode: '+49' },
    { code: 'FR', name: 'France', dialCode: '+33' },
    { code: 'IN', name: 'India', dialCode: '+91' },
    { code: 'CN', name: 'China', dialCode: '+86' },
    { code: 'JP', name: 'Japan', dialCode: '+81' },
    { code: 'BR', name: 'Brazil', dialCode: '+55' },
    { code: 'MX', name: 'Mexico', dialCode: '+52' },
    { code: 'IT', name: 'Italy', dialCode: '+39' },
    { code: 'ES', name: 'Spain', dialCode: '+34' },
    { code: 'RU', name: 'Russia', dialCode: '+7' },
    { code: 'KR', name: 'South Korea', dialCode: '+82' },
    { code: 'NL', name: 'Netherlands', dialCode: '+31' },
    { code: 'PL', name: 'Poland', dialCode: '+48' },
    { code: 'TR', name: 'Turkey', dialCode: '+90' },
    { code: 'AR', name: 'Argentina', dialCode: '+54' },
    { code: 'ZA', name: 'South Africa', dialCode: '+27' },
    { code: 'SE', name: 'Sweden', dialCode: '+46' },
    { code: 'NO', name: 'Norway', dialCode: '+47' },
    { code: 'DK', name: 'Denmark', dialCode: '+45' },
    { code: 'FI', name: 'Finland', dialCode: '+358' },
    { code: 'PT', name: 'Portugal', dialCode: '+351' },
    { code: 'CZ', name: 'Czech Republic', dialCode: '+420' },
    { code: 'HU', name: 'Hungary', dialCode: '+36' },
    { code: 'RO', name: 'Romania', dialCode: '+40' },
    { code: 'GR', name: 'Greece', dialCode: '+30' },
    { code: 'UA', name: 'Ukraine', dialCode: '+380' },
    { code: 'BE', name: 'Belgium', dialCode: '+32' },
    { code: 'AT', name: 'Austria', dialCode: '+43' },
    { code: 'CH', name: 'Switzerland', dialCode: '+41' },
    { code: 'IE', name: 'Ireland', dialCode: '+353' },
    { code: 'IL', name: 'Israel', dialCode: '+972' },
    { code: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
    { code: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
    { code: 'EG', name: 'Egypt', dialCode: '+20' },
    { code: 'NG', name: 'Nigeria', dialCode: '+234' },
    { code: 'KE', name: 'Kenya', dialCode: '+254' },
    { code: 'SG', name: 'Singapore', dialCode: '+65' },
    { code: 'MY', name: 'Malaysia', dialCode: '+60' },
    { code: 'ID', name: 'Indonesia', dialCode: '+62' },
    { code: 'PH', name: 'Philippines', dialCode: '+63' },
    { code: 'TH', name: 'Thailand', dialCode: '+66' },
    { code: 'VN', name: 'Vietnam', dialCode: '+84' },
    { code: 'PK', name: 'Pakistan', dialCode: '+92' },
    { code: 'BD', name: 'Bangladesh', dialCode: '+880' },
    { code: 'NZ', name: 'New Zealand', dialCode: '+64' },
    { code: 'CO', name: 'Colombia', dialCode: '+57' },
    { code: 'CL', name: 'Chile', dialCode: '+56' },
    { code: 'PE', name: 'Peru', dialCode: '+51' },
]

export class PhoneInput extends HTMLElement {
    // Participates in native <form> submission/validation like every tc-* input.
    static formAssociated = true

    private _initialised = false
    private _idPrefix: string
    private _inputId: string
    // Shared id for the reserved field-message slot, referenced by aria-describedby.
    private _helpId: string
    private _selectedCountry: PhoneCountry
    private _numberValue = ''
    private _isOpen = false
    private _activeIdx = -1
    private _menuOutsideHandler: ((e: MouseEvent) => void) | null = null
    private _menuKeyHandler: ((e: KeyboardEvent) => void) | null = null
    private _repositionHandler: (() => void) | null = null
    private _internals: ElementInternals
    private _defaultValue = ''

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'value',
            'name',
            'default-country',
            'label',
            'placeholder',
            'disabled',
            'required',
            'error',
            'state',
            'help',
            'max-height',
        ]
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._idPrefix = `tc-phone-${uid}`
        this._inputId = `${this._idPrefix}-input`
        this._helpId = `${this._idPrefix}-help`
        this._selectedCountry = PHONE_COUNTRIES.find((c) => c.code === 'US') ?? PHONE_COUNTRIES[0]
        this._internals = this.attachInternals()
    }

    // ── Getters/setters ───────────────────────────────────────────────────────

    get value(): string {
        return this._selectedCountry.dialCode + this._numberValue
    }
    set value(v: string | null) {
        if (v != null) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get defaultCountry(): string | null {
        return this.getAttribute('default-country')
    }
    set defaultCountry(v: string | null) {
        if (v != null) this.setAttribute('default-country', v)
        else this.removeAttribute('default-country')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get placeholder(): string | null {
        return this.getAttribute('placeholder')
    }
    set placeholder(v: string | null) {
        if (v != null) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    // Hint text shown in the reserved message slot (lowest precedence).
    get help(): string | null {
        return this.getAttribute('help')
    }
    set help(v: string | null) {
        if (v != null) this.setAttribute('help', v)
        else this.removeAttribute('help')
    }

    // 'valid' | 'invalid'; an `error` message forces 'invalid'.
    get state(): PhoneInputState | null {
        const v = this.getAttribute('state') as PhoneInputState
        return STATES.includes(v) ? v : null
    }
    set state(v: PhoneInputState | null) {
        if (v != null) this.setAttribute('state', v)
        else this.removeAttribute('state')
    }

    get maxHeight(): string {
        return this.getAttribute('max-height') ?? ''
    }
    set maxHeight(v: string) {
        if (v) this.setAttribute('max-height', v)
        else this.removeAttribute('max-height')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get required(): boolean {
        return this.hasAttribute('required')
    }
    set required(v: boolean) {
        if (v) this.setAttribute('required', '')
        else this.removeAttribute('required')
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    connectedCallback(): void {
        if (!this._initialised) {
            const dc = this.getAttribute('default-country')
            if (dc) {
                const found = PHONE_COUNTRIES.find((c) => c.code === dc.toUpperCase())
                if (found) this._selectedCountry = found
            }
            const v = this.getAttribute('value')
            if (v) this._parseValue(v)
            // Capture the initial value once so formResetCallback can restore it.
            this._defaultValue = v ?? ''
            this.render()
            this._initialised = true
        }
        this._applyMaxHeight()
        this._syncForm()
    }

    /** Called by the browser when the associated form resets. */
    formResetCallback(): void {
        this.value = this._defaultValue || null
        this._syncForm()
    }

    /** Called by the browser when a containing fieldset/form is disabled/enabled. */
    formDisabledCallback(disabled: boolean): void {
        this.disabled = disabled
    }

    /** Push value + validity into the form. The submitted value is the composite
     *  phone string (dial code + number); the field is "empty" when no number has
     *  been entered. Effective invalid = error / state invalid / required-empty. */
    private _syncForm(): void {
        const numberEntered = this._numberValue !== ''
        const value = this._computeValue()
        setFieldFormValue(this._internals, this.name, numberEntered ? value : null)
        const error = this.error
        const requiredEmpty = this.required && !numberEntered
        const invalid = !!error || this.state === 'invalid' || requiredEmpty
        reflectFieldValidity(this._internals, {
            invalid,
            valueMissing: requiredEmpty && !error,
            message:
                error ||
                (requiredEmpty ? msg('fieldRequired') : 'Please enter a valid phone number.'),
            anchor: this.querySelector<HTMLInputElement>('.tc-phone-input-number') ?? undefined,
        })
    }

    /**
     * Cap how tall the country dropdown grows before it scrolls. A bare number
     * is read as pixels; any CSS length (`50vh`, `20rem`, …) is honoured as-is.
     * Removing the attribute restores the stylesheet default (280px).
     */
    private _applyMaxHeight(): void {
        const h = cssLength(this.getAttribute('max-height'))
        if (h) this.style.setProperty('--bs-phone-input-dropdown-max-height', h)
        else this.style.removeProperty('--bs-phone-input-dropdown-max-height')
    }

    disconnectedCallback(): void {
        this._removeMenuHandlers()
        this._isOpen = false
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'max-height') {
            this._applyMaxHeight()
            return
        }

        if (name === 'value') {
            if (next !== null) this._parseValue(next)
            else this._numberValue = ''
        }
        if (name === 'default-country' && !this._numberValue) {
            if (next) {
                const found = PHONE_COUNTRIES.find((c) => c.code === next.toUpperCase())
                if (found) this._selectedCountry = found
            }
        }

        if (this._isOpen) this._closeDropdown(false)

        const hadFocus = !!this.querySelector('.tc-phone-input-number:focus')
        this.render()
        // value/required/state/error all affect the reflected validity + form value.
        this._syncForm()
        if (hadFocus) {
            this.querySelector<HTMLInputElement>('.tc-phone-input-number')?.focus()
        }
    }

    // ── Private: value ────────────────────────────────────────────────────────

    private _parseValue(v: string): void {
        // Longest dial-code prefix wins to avoid +1 matching +12 etc.
        const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length)
        for (const country of sorted) {
            if (v.startsWith(country.dialCode)) {
                this._selectedCountry = country
                this._numberValue = v.slice(country.dialCode.length)
                return
            }
        }
        this._numberValue = v
    }

    private _computeValue(): string {
        return this._selectedCountry.dialCode + this._numberValue
    }

    private _emitChange(): void {
        const val = this._computeValue()
        const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
        if (hidden) hidden.value = val
        // Reflect the new value into the form before notifying listeners.
        this._syncForm()
        dispatchFieldChange(this, val)
        if (typeof this.onChange === 'function') this.onChange(val)
    }

    // ── Private: dropdown ─────────────────────────────────────────────────────

    private _openDropdown(): void {
        if (this._isOpen) return
        this._isOpen = true
        this._activeIdx = -1

        const trigger = this.querySelector<HTMLButtonElement>('.tc-phone-input-country')
        const dropdown = this.querySelector<HTMLElement>('.tc-phone-input-dropdown')
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (dropdown) dropdown.classList.add('tc-phone-input-dropdown--open')

        // Anchor the fixed-positioned dropdown to the trigger (escapes overflow
        // clipping from ancestor scroll containers), then keep it anchored while
        // the page or an ancestor scrolls/resizes underneath it.
        this._positionDropdown()
        this._repositionHandler = () => this._positionDropdown()
        window.addEventListener('scroll', this._repositionHandler, true)
        window.addEventListener('resize', this._repositionHandler)

        const searchInput = this.querySelector<HTMLInputElement>('.tc-phone-input-search')
        if (searchInput) {
            searchInput.value = ''
            requestAnimationFrame(() => searchInput.focus())
        }

        this._menuOutsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeDropdown()
        }
        document.addEventListener('mousedown', this._menuOutsideHandler)

        this._menuKeyHandler = this._onDropdownKeydown
        document.addEventListener('keydown', this._menuKeyHandler)
    }

    private _closeDropdown(refocus = true): void {
        if (!this._isOpen) return
        this._isOpen = false
        this._activeIdx = -1

        const trigger = this.querySelector<HTMLButtonElement>('.tc-phone-input-country')
        const dropdown = this.querySelector<HTMLElement>('.tc-phone-input-dropdown')
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (dropdown) dropdown.classList.remove('tc-phone-input-dropdown--open')

        this._removeMenuHandlers()
        if (refocus) trigger?.focus()
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
        if (this._repositionHandler) {
            window.removeEventListener('scroll', this._repositionHandler, true)
            window.removeEventListener('resize', this._repositionHandler)
            this._repositionHandler = null
        }
    }

    private _selectCountry(code: string): void {
        const country = PHONE_COUNTRIES.find((c) => c.code === code)
        if (!country) return
        this._selectedCountry = country
        this._closeDropdown(false)
        const trigger = this.querySelector<HTMLButtonElement>('.tc-phone-input-country')
        if (trigger) {
            trigger.innerHTML = this._buildTriggerInner()
            trigger.setAttribute('aria-label', `Country: ${country.name} (${country.dialCode})`)
        }
        this._emitChange()
        this.querySelector<HTMLInputElement>('.tc-phone-input-number')?.focus()
    }

    private _onDropdownKeydown = (e: KeyboardEvent): void => {
        if (!this._isOpen) return

        if (e.key === 'Escape') {
            e.preventDefault()
            this._closeDropdown()
            return
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const options = this.querySelectorAll<HTMLElement>('.tc-phone-input-option')
            const len = options.length
            this._activeIdx = len > 0 ? Math.min(this._activeIdx + 1, len - 1) : -1
            this._highlightOption()
            return
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault()
            this._activeIdx = Math.max(this._activeIdx - 1, -1)
            this._highlightOption()
            return
        }

        if (e.key === 'Enter') {
            e.preventDefault()
            const options = Array.from(this.querySelectorAll<HTMLElement>('.tc-phone-input-option'))
            if (this._activeIdx >= 0 && this._activeIdx < options.length) {
                const code = options[this._activeIdx].dataset.code
                if (code) this._selectCountry(code)
            }
            return
        }

        if (e.key === 'Tab') {
            this._closeDropdown(false)
        }
    }

    private _highlightOption(): void {
        const options = Array.from(this.querySelectorAll<HTMLElement>('.tc-phone-input-option'))
        options.forEach((opt, idx) => {
            opt.classList.toggle('tc-phone-input-option--active', idx === this._activeIdx)
        })
        if (this._activeIdx >= 0 && options[this._activeIdx]) {
            options[this._activeIdx].scrollIntoView({ block: 'nearest' })
        }
    }

    /**
     * Position the fixed dropdown against the wrap (trigger anchor) in viewport
     * coordinates. The dropdown keeps its own CSS width; it opens below by
     * default and flips above when there isn't room beneath it. Left/top are
     * clamped so the panel never spills off-screen.
     */
    private _positionDropdown(): void {
        const dropdown = this.querySelector<HTMLElement>('.tc-phone-input-dropdown')
        const anchor = this.querySelector<HTMLElement>('.tc-phone-input-wrap')
        if (!dropdown || !anchor) return

        const gap = 2
        const margin = 4
        const r = anchor.getBoundingClientRect()
        const vw = window.innerWidth
        const vh = window.innerHeight

        const ddH = dropdown.offsetHeight
        const ddW = dropdown.offsetWidth
        const spaceBelow = vh - r.bottom
        const flipUp = spaceBelow < ddH + gap && r.top > spaceBelow

        let top = flipUp
            ? Math.max(margin, r.top - ddH - gap)
            : Math.min(r.bottom + gap, vh - ddH - margin)
        let left = Math.max(margin, Math.min(r.left, vw - ddW - margin))
        top = Math.max(margin, top)

        // Re-base onto the containing block when a transformed/filtered ancestor
        // has hijacked `position: fixed` (see fixedOriginOffset).
        const o = fixedOriginOffset(this)
        top -= o.y
        left -= o.x

        dropdown.style.top = `${top}px`
        dropdown.style.left = `${left}px`
    }

    private _buildTriggerInner(): string {
        const c = this._selectedCountry
        return (
            `<span class="tc-phone-input-flag" aria-hidden="true">${flagEmoji(c.code)}</span>` +
            `<span class="tc-phone-input-dial">${esc(c.dialCode)}</span>` +
            chevronDownIcon
        )
    }

    private _buildOptionsHtml(filter: string): string {
        const lf = filter.toLowerCase()
        const countries = filter
            ? PHONE_COUNTRIES.filter(
                  (c) =>
                      c.name.toLowerCase().includes(lf) ||
                      c.dialCode.includes(lf) ||
                      c.code.toLowerCase().includes(lf),
              )
            : PHONE_COUNTRIES

        if (!countries.length) {
            return `<div class="tc-phone-input-no-results">No countries found</div>`
        }
        return countries
            .map((c, idx) => {
                const activeCls = idx === this._activeIdx ? ' tc-phone-input-option--active' : ''
                const selectedAttr =
                    c.code === this._selectedCountry.code
                        ? ' aria-selected="true"'
                        : ' aria-selected="false"'
                return (
                    `<div class="tc-phone-input-option${activeCls}" role="option"${selectedAttr}` +
                    ` tabindex="-1" data-code="${esc(c.code)}">` +
                    `<span class="tc-phone-input-option-flag" aria-hidden="true">${flagEmoji(c.code)}</span>` +
                    `<span class="tc-phone-input-option-name">${esc(c.name)}</span>` +
                    `<span class="tc-phone-input-option-dial">${esc(c.dialCode)}</span>` +
                    `</div>`
                )
            })
            .join('')
    }

    private _renderDropdownOptions(filter: string): void {
        this._activeIdx = -1
        const listEl = this.querySelector<HTMLElement>('.tc-phone-input-list')
        if (listEl) listEl.innerHTML = this._buildOptionsHtml(filter)
        // Filtering changes the dropdown height; re-anchor so a flipped-up
        // dropdown stays attached to the trigger instead of drifting.
        if (this._isOpen) this._positionDropdown()
    }

    private render(): void {
        const label = this.label
        const placeholder = this.placeholder ?? ''
        const error = this.error
        const required = this.required
        const disabled = this.disabled
        // An `error` message forces the invalid state; `state` covers valid/invalid
        // without an accompanying message string.
        const state: PhoneInputState | null = error ? 'invalid' : this.state
        const isInvalid = state === 'invalid'

        const labelHtml = label
            ? `<label class="tc-phone-input-label" for="${this._inputId}">${esc(label)}${requiredMark(required)}</label>`
            : ''

        // The number input points at the single reserved slot whenever it carries
        // a message (hint / valid / invalid).
        const ariaDescribedBy =
            error || state || this.help ? ` aria-describedby="${this._helpId}"` : ''
        const ariaInvalid = isInvalid ? ' aria-invalid="true"' : ''
        // aria-required goes on the number input (the primary text-entry control).
        const ariaRequired = required ? ' aria-required="true"' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        const triggerAriaLabel = `Country: ${this._selectedCountry.name} (${this._selectedCountry.dialCode})`

        // Value submission flows through ElementInternals (formAssociated) — no
        // hidden mirror input, which would double-submit under the same name.

        // One reserved message slot below the group: invalid > valid > hint.
        const messageHtml = fieldMessageHtml({
            id: this._helpId,
            state,
            error,
            hint: this.help,
            invalidText: 'Please enter a valid phone number.',
            validText: 'Looks good!',
        })

        const optionsHtml = this._buildOptionsHtml('')

        patchHtml(
            this,
            [
                `<div class="tc-phone-input${isInvalid ? ' tc-phone-input--error' : ''}">`,
                labelHtml,
                `<div class="tc-phone-input-wrap">`,
                `<div class="tc-phone-input-group">`,
                `<button type="button" class="tc-phone-input-country"`,
                ` aria-haspopup="listbox" aria-expanded="false"`,
                disabledAttr,
                ` aria-label="${esc(triggerAriaLabel)}">`,
                this._buildTriggerInner(),
                `</button>`,
                `<input`,
                ` id="${this._inputId}"`,
                ` class="tc-phone-input-number"`,
                ` type="tel"`,
                ` inputmode="tel"`,
                ` placeholder="${esc(placeholder)}"`,
                ` value="${esc(this._numberValue)}"`,
                ariaInvalid,
                ariaRequired,
                ariaDescribedBy,
                disabledAttr,
                `>`,
                `</div>`,
                `<div class="tc-phone-input-dropdown" role="listbox" aria-label="Country selector">`,
                `<div class="tc-phone-input-search-wrap">`,
                `<input type="text" class="tc-phone-input-search"`,
                ` placeholder="Search countries…" autocomplete="off" aria-label="Search countries">`,
                `</div>`,
                `<div class="tc-phone-input-list">`,
                optionsHtml,
                `</div>`,
                `</div>`,
                `</div>`,
                messageHtml,
                `</div>`,
            ].join(''),
        )

        const trigger = this.querySelector<HTMLButtonElement>('.tc-phone-input-country')
        if (trigger) {
            bindOnce(trigger, 'click', () => {
                if (this._isOpen) this._closeDropdown(false)
                else this._openDropdown()
            })
        }

        const numberInput = this.querySelector<HTMLInputElement>('.tc-phone-input-number')
        if (numberInput) {
            bindOnce(numberInput, 'input', () => {
                this._numberValue = numberInput.value
                this._emitChange()
            })
        }

        const searchInput = this.querySelector<HTMLInputElement>('.tc-phone-input-search')
        if (searchInput) {
            bindOnce(searchInput, 'input', () => {
                this._renderDropdownOptions(searchInput.value)
            })
        }

        const listEl = this.querySelector<HTMLElement>('.tc-phone-input-list')
        if (listEl) {
            bindOnce(listEl, 'click', (e: MouseEvent) => {
                const opt = (e.target as Element).closest<HTMLElement>('.tc-phone-input-option')
                if (opt?.dataset.code) this._selectCountry(opt.dataset.code)
            })
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PhoneInput
    }
}
