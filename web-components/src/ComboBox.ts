import { esc } from './internal/esc'
import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-combo-box'

export interface ComboOption {
    value: string
    label: string
    keywords?: string[]
}

export class ComboBox extends HTMLElement {
    private _initialised = false
    private _options: ComboOption[] = []
    private _isOpen = false
    private _query = ''
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private _docKeyHandler: ((e: KeyboardEvent) => void) | null = null

    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'disabled']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'combobox')
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeOpenHandlers()
        this._isOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── Attribute getters/setters ─────────────────────────────────────────

    get value(): string {
        return this.getAttribute('value') ?? ''
    }
    set value(v: string) {
        if (v) this.setAttribute('value', v)
        else this.removeAttribute('value')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Select…'
    }
    set placeholder(v: string) {
        if (v) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── JS property: options ──────────────────────────────────────────────

    get options(): ComboOption[] {
        return this._options
    }
    set options(v: ComboOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    // ── Open/close ─────────────────────────────────────────────────────────

    private _toggleOpen(force?: boolean): void {
        if (this.disabled) {
            this._isOpen = false
        } else {
            this._isOpen = force != null ? force : !this._isOpen
        }
        if (!this._isOpen) {
            this._query = ''
            this._removeOpenHandlers()
        }
        this.render()
        if (this._isOpen) {
            this._attachOpenHandlers()
            const input = this.querySelector<HTMLInputElement>('.tc-combo-box__search-input')
            if (input) requestAnimationFrame(() => input.focus())
        }
    }

    private _attachOpenHandlers(): void {
        this._removeOpenHandlers()
        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._toggleOpen(false)
        }
        this._docKeyHandler = (e: KeyboardEvent) => {
            if (!this._isOpen) return
            if (e.key === 'Escape') {
                e.preventDefault()
                this._toggleOpen(false)
                const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
                trigger?.focus()
            }
        }
        document.addEventListener('mousedown', this._outsideHandler)
        document.addEventListener('keydown', this._docKeyHandler)
    }

    private _removeOpenHandlers(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
        if (this._docKeyHandler) {
            document.removeEventListener('keydown', this._docKeyHandler)
            this._docKeyHandler = null
        }
    }

    // ── Filtering ──────────────────────────────────────────────────────────

    private _filteredOptions(): ComboOption[] {
        const q = this._query.trim().toLowerCase()
        if (!q) return this._options
        return this._options.filter((opt) => {
            if (opt.label.toLowerCase().includes(q)) return true
            if (opt.value.toLowerCase().includes(q)) return true
            if (opt.keywords?.some((k) => k.toLowerCase().includes(q))) return true
            return false
        })
    }

    private _buildOptionsHtml(): string {
        const filtered = this._filteredOptions()
        if (!filtered.length) {
            return `<div class="tc-combo-box__empty">No matches</div>`
        }
        return filtered
            .map((opt) => {
                const isSelected = opt.value === this.value
                const selectedCls = isSelected ? ' tc-combo-box__option--selected' : ''
                return (
                    `<div class="tc-combo-box__option${selectedCls}" role="option"` +
                    ` tabindex="0" aria-selected="${isSelected}" data-value="${esc(opt.value)}">` +
                    `${esc(opt.label)}</div>`
                )
            })
            .join('')
    }

    // ── Selection ──────────────────────────────────────────────────────────

    private _select(value: string): void {
        if (!value || value === this.value) {
            this._toggleOpen(false)
            return
        }
        this.value = value
        this._toggleOpen(false)
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value },
            }),
        )
        this.dispatchEvent(new Event('change', { bubbles: true }))
        if (typeof this.onChange === 'function') this.onChange(value)
    }

    // ── Render ─────────────────────────────────────────────────────────────

    private render(): void {
        const selected = this._options.find((o) => o.value === this.value)
        const triggerLabel = selected ? selected.label : this.placeholder
        const placeholderCls = selected ? '' : ' tc-combo-box__trigger--placeholder'

        let popoverHtml = ''
        if (this._isOpen && !this.disabled) {
            popoverHtml =
                `<div class="tc-combo-box__popover">` +
                `<div class="tc-combo-box__search">` +
                `<input type="text" class="tc-combo-box__search-input" placeholder="Search…"` +
                ` autocomplete="off" aria-label="Search options" value="${esc(this._query)}" />` +
                `</div>` +
                `<div class="tc-combo-box__list" role="listbox">${this._buildOptionsHtml()}</div>` +
                `</div>`
        }

        this.innerHTML =
            `<button type="button" class="tc-combo-box__trigger${placeholderCls}"` +
            ` aria-haspopup="listbox" aria-expanded="${this._isOpen && !this.disabled}"` +
            ` ${this.disabled ? 'disabled' : ''}>` +
            `<span class="tc-combo-box__trigger-label">${esc(triggerLabel)}</span>` +
            `<span class="tc-combo-box__caret">${chevronDownIcon}</span>` +
            `</button>` +
            popoverHtml

        const trigger = this.querySelector<HTMLButtonElement>('.tc-combo-box__trigger')
        trigger?.addEventListener('click', () => this._toggleOpen())

        const input = this.querySelector<HTMLInputElement>('.tc-combo-box__search-input')
        if (input) {
            input.addEventListener('input', () => {
                this._query = input.value
                this._renderListOnly()
            })
            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    const first = this.querySelector<HTMLElement>('.tc-combo-box__option')
                    if (first?.dataset.value != null) this._select(first.dataset.value)
                }
            })
        }

        this._wireOptions()
    }

    private _renderListOnly(): void {
        const list = this.querySelector<HTMLElement>('.tc-combo-box__list')
        if (!list) return
        list.innerHTML = this._buildOptionsHtml()
        this._wireOptions()
    }

    private _wireOptions(): void {
        this.querySelectorAll<HTMLElement>('.tc-combo-box__option').forEach((el) => {
            const handle = () => this._select(el.dataset.value ?? '')
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key !== 'Enter' && e.key !== ' ') return
                e.preventDefault()
                handle()
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ComboBox
    }
}
