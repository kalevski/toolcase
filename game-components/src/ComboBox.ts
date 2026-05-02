const TAG_NAME = 'gc-combo-box'

export interface ComboOption {
    value: string
    label: string
    keywords?: string[]
}

export interface ComboBoxEventMap {
    change: CustomEvent<{ value: string }>
}

export class ComboBox extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'disabled']
    }

    private _options: ComboOption[] = []
    private isOpen = false
    private query = ''
    private outsideDownHandler = (event: MouseEvent) => this.handleOutside(event)
    private docKeyHandler = (event: KeyboardEvent) => this.handleDocKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'combobox')
        document.addEventListener('mousedown', this.outsideDownHandler)
        document.addEventListener('keydown', this.docKeyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('mousedown', this.outsideDownHandler)
        document.removeEventListener('keydown', this.docKeyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get options(): ComboOption[] {
        return this._options
    }
    set options(value: ComboOption[]) {
        this._options = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

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
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private toggleOpen(force?: boolean): void {
        if (this.disabled) {
            this.isOpen = false
        } else {
            this.isOpen = force != null ? force : !this.isOpen
        }
        if (!this.isOpen) this.query = ''
        this.render()
        if (this.isOpen) {
            const input = this.querySelector('.gc-combo-box-input') as HTMLInputElement | null
            input?.focus()
        }
    }

    private handleOutside(event: MouseEvent): void {
        if (!this.isOpen) return
        if (this.contains(event.target as Node)) return
        this.toggleOpen(false)
    }

    private handleDocKey(event: KeyboardEvent): void {
        if (!this.isOpen) return
        if (event.key === 'Escape') {
            event.preventDefault()
            this.toggleOpen(false)
        }
    }

    private filteredOptions(): ComboOption[] {
        const q = this.query.trim().toLowerCase()
        if (!q) return this._options
        return this._options.filter((opt) => {
            if (opt.label.toLowerCase().includes(q)) return true
            if (opt.value.toLowerCase().includes(q)) return true
            if (opt.keywords?.some((k) => k.toLowerCase().includes(q))) return true
            return false
        })
    }

    private render(): void {
        const selected = this._options.find((o) => o.value === this.value)
        const buttonLabel = selected ? selected.label : this.placeholder
        const buttonCls = `gc-combo-box-button${selected ? '' : ' is-placeholder'}${this.disabled ? ' is-disabled' : ''}`

        let listMarkup = ''
        if (this.isOpen) {
            const filtered = this.filteredOptions()
            const optionMarkup = filtered.length
                ? filtered.map((opt) => {
                    const isSelected = opt.value === this.value
                    const cls = `gc-combo-box-option${isSelected ? ' is-selected' : ''}`
                    return `<div role="option" tabindex="0" aria-selected="${isSelected}" class="${cls}" data-value="${this.escape(opt.value)}">${this.escape(opt.label)}</div>`
                }).join('')
                : `<div class="gc-combo-box-empty">No matches</div>`
            listMarkup = `
                <div class="gc-combo-box-popover">
                    <div class="gc-combo-box-search">
                        <input type="text" class="gc-combo-box-input" placeholder="Search…" value="${this.escape(this.query)}" />
                    </div>
                    <div class="gc-combo-box-list" role="listbox">${optionMarkup}</div>
                </div>
            `
        }

        this.innerHTML = `
            <button type="button" class="${buttonCls}" aria-haspopup="listbox" aria-expanded="${this.isOpen}" ${this.disabled ? 'disabled' : ''}>
                <span class="gc-combo-box-button-label">${this.escape(buttonLabel)}</span>
                <span class="gc-combo-box-button-caret">▾</span>
            </button>
            ${listMarkup}
        `

        const button = this.querySelector('.gc-combo-box-button') as HTMLButtonElement | null
        button?.addEventListener('click', () => this.toggleOpen())

        const input = this.querySelector('.gc-combo-box-input') as HTMLInputElement | null
        input?.addEventListener('input', (event) => {
            this.query = (event.target as HTMLInputElement).value
            this.renderListOnly()
        })
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault()
                const first = this.querySelector('.gc-combo-box-option') as HTMLElement | null
                first?.click()
            }
        })

        this.querySelectorAll<HTMLElement>('.gc-combo-box-option').forEach((el) => {
            const handle = () => {
                const v = el.dataset.value || ''
                if (!v || v === this.value) {
                    this.toggleOpen(false)
                    return
                }
                this.value = v
                this.toggleOpen(false)
                this.emit('change', { value: v })
            }
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                handle()
            })
        })
    }

    private renderListOnly(): void {
        const list = this.querySelector('.gc-combo-box-list') as HTMLElement | null
        if (!list) return
        const filtered = this.filteredOptions()
        list.innerHTML = filtered.length
            ? filtered.map((opt) => {
                const isSelected = opt.value === this.value
                const cls = `gc-combo-box-option${isSelected ? ' is-selected' : ''}`
                return `<div role="option" tabindex="0" aria-selected="${isSelected}" class="${cls}" data-value="${this.escape(opt.value)}">${this.escape(opt.label)}</div>`
            }).join('')
            : `<div class="gc-combo-box-empty">No matches</div>`
        list.querySelectorAll<HTMLElement>('.gc-combo-box-option').forEach((el) => {
            const handle = () => {
                const v = el.dataset.value || ''
                if (!v) return
                this.value = v
                this.toggleOpen(false)
                this.emit('change', { value: v })
            }
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                handle()
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ComboBox)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ComboBox
    }
}
