const TAG_NAME = 'tc-otp-input'

let _idCounter = 0

export type OTPInputMode = 'numeric' | 'alphanumeric'

const MODES: OTPInputMode[] = ['numeric', 'alphanumeric']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class OTPInput extends HTMLElement {
    private _initialised = false
    private _idPrefix: string
    private _errorId: string
    private _labelId: string
    private _cells: string[] = []

    onChange: ((value: string) => void) | null = null
    onComplete: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['length', 'value', 'name', 'mode', 'masked', 'label', 'error']
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._idPrefix = `tc-otp-${uid}`
        this._errorId = `${this._idPrefix}-error`
        this._labelId = `${this._idPrefix}-label`
    }

    // ── length ─────────────────────────────────────────────────────────────
    get length(): number {
        const raw = this.getAttribute('length')
        if (raw === null) return 6
        const n = parseInt(raw, 10)
        return isNaN(n) || n < 1 ? 6 : Math.min(n, 20)
    }
    set length(v: number) {
        this.setAttribute('length', String(v))
    }

    // ── value ──────────────────────────────────────────────────────────────
    get value(): string {
        return this._cells.join('')
    }
    set value(v: string | null) {
        const str = v ?? ''
        const len = this.length
        this._cells = Array.from({ length: len }, (_, i) => str[i] ?? '')
        if (str) this.setAttribute('value', str)
        else this.removeAttribute('value')
        if (this._initialised) {
            this._patchCellValues()
            const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
            if (hidden) hidden.value = str
        }
    }

    // ── name ───────────────────────────────────────────────────────────────
    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    // ── mode ───────────────────────────────────────────────────────────────
    get mode(): OTPInputMode {
        const v = this.getAttribute('mode') as OTPInputMode
        return MODES.includes(v) ? v : 'numeric'
    }
    set mode(v: OTPInputMode) {
        this.setAttribute('mode', v)
    }

    // ── masked ─────────────────────────────────────────────────────────────
    get masked(): boolean {
        return this.hasAttribute('masked')
    }
    set masked(v: boolean) {
        if (v) this.setAttribute('masked', '')
        else this.removeAttribute('masked')
    }

    // ── label ──────────────────────────────────────────────────────────────
    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    // ── error ──────────────────────────────────────────────────────────────
    get error(): string | null {
        return this.getAttribute('error')
    }
    set error(v: string | null) {
        if (v != null) this.setAttribute('error', v)
        else this.removeAttribute('error')
    }

    // ───────────────────────────────────────────────────────────────────────

    connectedCallback(): void {
        if (!this._initialised) {
            const len = this.length
            const val = this.getAttribute('value') ?? ''
            this._cells = Array.from({ length: len }, (_, i) => val[i] ?? '')
            this.render()
            this.addEventListener('keydown', this._onKeydown)
            this.addEventListener('input', this._onInput)
            this.addEventListener('paste', this._onPaste)
            this.addEventListener('focusin', this._onFocusin)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('paste', this._onPaste)
        this.removeEventListener('focusin', this._onFocusin)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'value') {
            const str = next ?? ''
            const len = this.length
            this._cells = Array.from({ length: len }, (_, i) => str[i] ?? '')
            this._patchCellValues()
            const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
            if (hidden) hidden.value = str
            return
        }

        if (name === 'length') {
            const newLen = this.length
            this._cells = Array.from({ length: newLen }, (_, i) => this._cells[i] ?? '')
        }

        const focusedIdx = this._getFocusedCellIndex()
        this.render()
        if (focusedIdx >= 0) {
            const cells = this._getCells()
            const target = cells[Math.min(focusedIdx, cells.length - 1)]
            target?.focus()
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Event handlers (arrow-function properties for stable references)
    // ───────────────────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const idx = cells.indexOf(input)
        if (idx < 0) return

        if (e.key === 'Backspace') {
            e.preventDefault()
            if (this._cells[idx] !== '') {
                this._cells[idx] = ''
                input.value = ''
                input.classList.remove('tc-otp-input__cell--filled')
                this._syncValue()
            } else if (idx > 0) {
                const prev = cells[idx - 1]
                this._cells[idx - 1] = ''
                prev.value = ''
                prev.classList.remove('tc-otp-input__cell--filled')
                prev.focus()
                this._syncValue()
            }
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault()
            if (idx > 0) cells[idx - 1].focus()
        } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            if (idx < cells.length - 1) cells[idx + 1].focus()
        } else if (e.key === 'Delete') {
            e.preventDefault()
            this._cells[idx] = ''
            input.value = ''
            input.classList.remove('tc-otp-input__cell--filled')
            this._syncValue()
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            // Validate character before browser inserts it
            if (!this._isAllowed(e.key)) {
                e.preventDefault()
            }
        }
    }

    private _onInput = (e: Event): void => {
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const idx = cells.indexOf(input)
        if (idx < 0) return

        const raw = input.value
        const filtered = this._filterChars(raw)
        const char = filtered.slice(0, 1)

        this._cells[idx] = char
        input.value = char

        if (char) {
            input.classList.add('tc-otp-input__cell--filled')
            if (idx < cells.length - 1) {
                cells[idx + 1].focus()
            }
        } else {
            input.classList.remove('tc-otp-input__cell--filled')
        }

        this._syncValue()
    }

    private _onPaste = (e: ClipboardEvent): void => {
        e.preventDefault()
        const input = e.target as HTMLInputElement
        if (!input.classList.contains('tc-otp-input__cell')) return

        const cells = this._getCells()
        const startIdx = cells.indexOf(input)
        if (startIdx < 0) return

        const pasted = e.clipboardData?.getData('text') ?? ''
        const filtered = this._filterChars(pasted)

        for (let i = 0; i < filtered.length && startIdx + i < cells.length; i++) {
            const char = filtered[i]
            this._cells[startIdx + i] = char
            cells[startIdx + i].value = char
            if (char) {
                cells[startIdx + i].classList.add('tc-otp-input__cell--filled')
            } else {
                cells[startIdx + i].classList.remove('tc-otp-input__cell--filled')
            }
        }

        const lastIdx = Math.min(startIdx + filtered.length, cells.length - 1)
        cells[lastIdx]?.focus()
        this._syncValue()
    }

    private _onFocusin = (e: FocusEvent): void => {
        const input = e.target as HTMLInputElement
        if (input.classList.contains('tc-otp-input__cell')) {
            input.select()
        }
    }

    // ───────────────────────────────────────────────────────────────────────
    // Private helpers
    // ───────────────────────────────────────────────────────────────────────

    private _isAllowed(char: string): boolean {
        if (this.mode === 'numeric') return /^[0-9]$/.test(char)
        return /^[a-zA-Z0-9]$/.test(char)
    }

    private _filterChars(s: string): string {
        if (this.mode === 'numeric') return s.replace(/[^0-9]/g, '')
        return s.replace(/[^a-zA-Z0-9]/g, '')
    }

    private _getCells(): HTMLInputElement[] {
        return Array.from(this.querySelectorAll<HTMLInputElement>('.tc-otp-input__cell'))
    }

    private _getFocusedCellIndex(): number {
        const cells = this._getCells()
        const focused = this.querySelector<HTMLInputElement>('.tc-otp-input__cell:focus')
        return focused ? cells.indexOf(focused) : -1
    }

    private _patchCellValues(): void {
        const cells = this._getCells()
        cells.forEach((cell, i) => {
            const char = this._cells[i] ?? ''
            cell.value = char
            if (char) cell.classList.add('tc-otp-input__cell--filled')
            else cell.classList.remove('tc-otp-input__cell--filled')
        })
    }

    private _syncValue(): void {
        const combined = this._cells.join('')

        const hidden = this.querySelector<HTMLInputElement>('input[type="hidden"]')
        if (hidden) hidden.value = combined

        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value: combined },
        }))
        if (typeof this.onChange === 'function') this.onChange(combined)

        if (this._cells.length > 0 && this._cells.every(c => c !== '')) {
            this.dispatchEvent(new CustomEvent('tc-complete', {
                bubbles: true,
                composed: true,
                detail: { value: combined },
            }))
            if (typeof this.onComplete === 'function') this.onComplete(combined)
        }
    }

    private render(): void {
        const len = this.length
        const label = this.label
        const error = this.error
        const name = this.name
        const masked = this.masked
        const mode = this.mode
        const hasError = !!error

        const inputType = masked ? 'password' : 'text'
        const inputMode = mode === 'numeric' ? 'numeric' : 'text'

        const ariaLabelledBy = label ? ` aria-labelledby="${this._labelId}"` : ` aria-label="One-time password"`
        const ariaInvalid = hasError ? ' aria-invalid="true"' : ''
        const ariaDescribedBy = hasError ? ` aria-describedby="${this._errorId}"` : ''

        const labelHtml = label
            ? `<label class="tc-otp-input__label" id="${this._labelId}">${esc(label)}</label>`
            : ''

        const cellsHtml = Array.from({ length: len }, (_, i) => {
            const char = this._cells[i] ?? ''
            const valueAttr = char ? ` value="${esc(char)}"` : ''
            const filledClass = char ? ' tc-otp-input__cell--filled' : ''
            const cellAriaLabel = `Digit ${i + 1} of ${len}`
            return [
                `<input`,
                ` class="tc-otp-input__cell${filledClass}"`,
                ` type="${inputType}"`,
                ` inputmode="${inputMode}"`,
                ` maxlength="1"`,
                ` autocomplete="one-time-code"`,
                ` aria-label="${esc(cellAriaLabel)}"`,
                hasError ? ' aria-invalid="true"' : '',
                ariaDescribedBy,
                valueAttr,
                `>`,
            ].join('')
        }).join('')

        const hiddenHtml = name
            ? `<input type="hidden" name="${esc(name)}" value="${esc(this._cells.join(''))}">`
            : ''

        const errorHtml = hasError
            ? `<div class="tc-otp-input__error" id="${this._errorId}" role="alert">${esc(error!)}</div>`
            : ''

        this.innerHTML = [
            `<div class="tc-otp-input"`,
            ` role="group"`,
            ariaLabelledBy,
            ariaInvalid,
            `>`,
            labelHtml,
            `<div class="tc-otp-input__cells">`,
            cellsHtml,
            `</div>`,
            hiddenHtml,
            errorHtml,
            `</div>`,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: OTPInput
    }
}
