import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-multi-card-select'

export interface MultiCardSelectOption {
    value: string
    label: string
    description?: string
    /** Lucide icon name, PascalCase or kebab-case (e.g. "Shield", "shield-check"). */
    icon?: string
    disabled?: boolean
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string, className?: string): string {
    const pascal = name
        .split('-')
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
    const svg = (LucideIcons as Record<string, string>)[pascal]
    if (!svg) return ''
    return icon(svg, className)
}

// Pre-compute check icon — always rendered in every card (hidden via opacity/display).
const checkIconHtml = lucideByName('check')

export class MultiCardSelect extends HTMLElement {
    private _initialised = false
    private _options: MultiCardSelectOption[] = []
    private _value: string[] = []

    /** Optional callback fired alongside the `tc-change` CustomEvent. */
    onChange: ((value: string[]) => void) | null = null

    static get observedAttributes(): string[] {
        return ['name', 'columns', 'loading', 'loading-count']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label', 'Select options')
            }
            this.render()
            this.addEventListener('click', this._onClick)
            this.addEventListener('keydown', this._onKeydown)
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get options(): MultiCardSelectOption[] {
        return this._options
    }
    set options(v: MultiCardSelectOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get value(): string[] {
        return this._value
    }
    set value(v: string[]) {
        this._value = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get columns(): number {
        return Math.max(1, parseInt(this.getAttribute('columns') ?? '2', 10) || 2)
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    get loadingCount(): number {
        return Math.max(1, parseInt(this.getAttribute('loading-count') ?? '4', 10) || 4)
    }
    set loadingCount(v: number) {
        this.setAttribute('loading-count', String(v))
    }

    private _toggle(value: string): void {
        if (this._value.includes(value)) {
            this._value = this._value.filter(v => v !== value)
        } else {
            this._value = [...this._value, value]
        }
        // Surgical patch preserves focus across toggle interactions.
        this._patchSelection()
        this.dispatchEvent(new CustomEvent('tc-change', {
            bubbles: true,
            composed: true,
            detail: { value: this._value },
        }))
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }

    private _patchSelection(): void {
        const selectedSet = new Set(this._value)

        Array.from(this.querySelectorAll<HTMLElement>('[role="checkbox"]')).forEach(card => {
            const val = card.dataset.value ?? ''
            const isSelected = selectedSet.has(val)
            card.classList.toggle('is-selected', isSelected)
            card.setAttribute('aria-checked', String(isSelected))
        })

        // Rebuild hidden inputs for form submission.
        this.querySelectorAll<HTMLInputElement>('input[type="hidden"]').forEach(i => i.remove())
        const name = this.name
        if (name) {
            const validValues = new Set(this._options.map(o => o.value))
            this._value.filter(v => validValues.has(v)).forEach(v => {
                const input = document.createElement('input')
                input.type = 'hidden'
                input.name = name
                input.value = v
                this.appendChild(input)
            })
        }
    }

    private _onClick = (e: MouseEvent): void => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[role="checkbox"]')
        if (!card || !this.contains(card)) return
        if (card.getAttribute('aria-disabled') === 'true') return
        const val = card.dataset.value
        if (val != null) this._toggle(val)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as HTMLElement
        if (!target.matches('[role="checkbox"]')) return

        const allCards = Array.from(this.querySelectorAll<HTMLElement>('[role="checkbox"]'))
        const enabledCards = allCards.filter(c => c.getAttribute('aria-disabled') !== 'true')
        const idx = enabledCards.indexOf(target)

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault()
            if (enabledCards.length === 0) return
            const next = (idx >= 0 ? (idx + 1) % enabledCards.length : 0)
            allCards.forEach(c => c.setAttribute('tabindex', '-1'))
            enabledCards[next].setAttribute('tabindex', '0')
            enabledCards[next].focus()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault()
            if (enabledCards.length === 0) return
            const prev = idx > 0 ? idx - 1 : enabledCards.length - 1
            allCards.forEach(c => c.setAttribute('tabindex', '-1'))
            enabledCards[prev].setAttribute('tabindex', '0')
            enabledCards[prev].focus()
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            if (idx < 0) return
            const val = target.dataset.value
            if (val != null) this._toggle(val)
        }
    }

    private render(): void {
        const loading = this.loading
        const columns = this.columns

        this.classList.add('tc-multi-card-select')
        this.style.setProperty('--bs-multi-card-select-columns', String(columns))

        if (loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const count = this.loadingCount
            const skeletons = Array.from({ length: count }, () =>
                `<div class="tc-multi-card-select-card tc-multi-card-select-card--skeleton" aria-hidden="true"></div>`
            ).join('')
            this.innerHTML = `<span class="visually-hidden">Loading…</span>${skeletons}`
            return
        }

        this.setAttribute('role', 'group')
        this.removeAttribute('aria-busy')

        const name = this.name
        const selectedSet = new Set(this._value)
        const firstEnabledIdx = this._options.findIndex(o => !o.disabled)
        const hasSelectedEnabled = this._options.some(o => selectedSet.has(o.value) && !o.disabled)
        let tabIdxAssigned = false

        const cardsHtml = this._options.map((opt, idx) => {
            const isSelected = selectedSet.has(opt.value)
            const isDisabled = !!opt.disabled

            let tabindex = '-1'
            if (!isDisabled && !tabIdxAssigned) {
                if (isSelected || (!hasSelectedEnabled && idx === firstEnabledIdx)) {
                    tabindex = '0'
                    tabIdxAssigned = true
                }
            }

            const selectedClass = isSelected ? ' is-selected' : ''
            const disabledClass = isDisabled ? ' tc-multi-card-select-card--disabled' : ''
            const ariaDisabledAttr = isDisabled ? ' aria-disabled="true"' : ''
            const tabindexAttr = isDisabled ? '' : ` tabindex="${tabindex}"`

            let iconHtml = ''
            if (opt.icon) {
                const svgStr = lucideByName(opt.icon, 'tc-multi-card-select-icon-svg')
                if (svgStr) iconHtml = `<span class="tc-multi-card-select-icon">${svgStr}</span>`
            }

            const descHtml = opt.description
                ? `<span class="tc-multi-card-select-desc">${esc(opt.description)}</span>`
                : ''

            return [
                `<div class="tc-multi-card-select-card${selectedClass}${disabledClass}"`,
                ` role="checkbox" aria-checked="${isSelected}"${ariaDisabledAttr}`,
                `${tabindexAttr} data-value="${esc(opt.value)}">`,
                iconHtml,
                `<span class="tc-multi-card-select-label">${esc(opt.label)}</span>`,
                descHtml,
                `<span class="tc-multi-card-select-check" aria-hidden="true">${checkIconHtml}</span>`,
                `</div>`,
            ].join('')
        }).join('')

        let hiddenInputsHtml = ''
        if (name) {
            const validValues = new Set(this._options.map(o => o.value))
            hiddenInputsHtml = this._value
                .filter(v => validValues.has(v))
                .map(v => `<input type="hidden" name="${esc(name)}" value="${esc(v)}">`)
                .join('')
        }

        this.innerHTML = cardsHtml + hiddenInputsHtml
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MultiCardSelect
    }
}
