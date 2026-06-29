import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-single-card-select'

export interface SingleCardSelectOption {
    key: string
    title: string
    description?: string
}

// Pre-compute the check icon — always rendered in every card (hidden via opacity until selected).
const checkIconHtml = lucideByName('check')

export class SingleCardSelect extends HTMLElement {
    private _initialised = false
    private _options: SingleCardSelectOption[] = []

    /** Optional callback fired alongside the `tc-change` CustomEvent. */
    onChange: ((selected: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'name', 'columns', 'loading', 'loading-count']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label', 'Select an option')
            }
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            // Surgical patch preserves focus across selection changes.
            this._patchSelection()
        } else {
            this.render()
        }
    }

    get options(): SingleCardSelectOption[] {
        return this._options
    }
    set options(v: SingleCardSelectOption[]) {
        this._options = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get value(): string | null {
        return this.getAttribute('value')
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

    /** Number of grid columns, or null for the auto-fill default (matches React). */
    get columns(): number | null {
        if (!this.hasAttribute('columns')) return null
        return Math.max(1, parseInt(this.getAttribute('columns') ?? '1', 10) || 1)
    }
    set columns(v: number | null) {
        if (v != null) this.setAttribute('columns', String(v))
        else this.removeAttribute('columns')
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

    private _select(key: string): void {
        const prev = this.value
        this.setAttribute('value', key)
        if (key !== prev) {
            this.dispatchEvent(
                new CustomEvent('tc-change', {
                    bubbles: true,
                    composed: true,
                    detail: { value: key },
                }),
            )
            if (typeof this.onChange === 'function') this.onChange(key)
        }
    }

    /** Update selection state in place (aria-checked, is-selected, roving tabindex, hidden input). */
    private _patchSelection(): void {
        const value = this.value
        let hasTabStop = false
        const cards = Array.from(this.querySelectorAll<HTMLElement>('[role="radio"]'))
        cards.forEach((card) => {
            const isSelected = card.dataset.key === value
            card.classList.toggle('is-selected', isSelected)
            card.setAttribute('aria-checked', String(isSelected))
            if (isSelected) {
                card.setAttribute('tabindex', '0')
                hasTabStop = true
            } else {
                card.setAttribute('tabindex', '-1')
            }
        })
        if (!hasTabStop && cards.length > 0) {
            cards[0].setAttribute('tabindex', '0')
        }

        // Keep the hidden form input in sync with the selected key.
        const input = this.querySelector<HTMLInputElement>('input[type="hidden"]')
        if (input) input.value = value ?? ''
    }

    private _onClick = (e: MouseEvent): void => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[role="radio"]')
        if (!card || !this.contains(card)) return
        const key = card.dataset.key
        if (key == null) return
        this._moveFocus(this.querySelectorAll<HTMLElement>('[role="radio"]'), card)
        this._select(key)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as HTMLElement
        if (!target.matches('[role="radio"]')) return

        const cards = Array.from(this.querySelectorAll<HTMLElement>('[role="radio"]'))
        if (cards.length === 0) return
        const idx = cards.indexOf(target)
        if (idx < 0) return

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            const next = cards[(idx + 1) % cards.length]
            this._moveFocus(cards, next)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = cards[(idx - 1 + cards.length) % cards.length]
            this._moveFocus(cards, prev)
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            const key = target.dataset.key
            if (key != null) this._select(key)
        }
    }

    private _moveFocus(cards: ArrayLike<HTMLElement>, target: HTMLElement): void {
        Array.from(cards).forEach((c) => c.setAttribute('tabindex', c === target ? '0' : '-1'))
        target.focus()
    }

    private render(): void {
        this.classList.add('tc-single-card-select')

        const cols = this.columns
        if (cols != null) {
            this.style.setProperty('--bs-single-card-select-grid-cols', `repeat(${cols}, 1fr)`)
        } else {
            this.style.removeProperty('--bs-single-card-select-grid-cols')
        }

        if (this.loading) {
            this.setAttribute('role', 'status')
            this.setAttribute('aria-busy', 'true')
            const count = this.loadingCount
            const skeletons = Array.from(
                { length: count },
                () =>
                    `<div class="tc-single-card-select-option tc-single-card-select-option--skeleton" aria-hidden="true"></div>`,
            ).join('')
            this.innerHTML = `<span class="visually-hidden">Loading…</span>${skeletons}`
            return
        }

        this.setAttribute('role', 'radiogroup')
        this.removeAttribute('aria-busy')

        const value = this.value
        const selectedIdx = this._options.findIndex((o) => o.key === value)

        const cardsHtml = this._options
            .map((opt, idx) => {
                const isSelected = opt.key === value
                const tabindex = isSelected || (selectedIdx < 0 && idx === 0) ? '0' : '-1'
                const selectedClass = isSelected ? ' is-selected' : ''

                const descHtml = opt.description
                    ? `<span class="tc-single-card-select-desc">${esc(opt.description)}</span>`
                    : ''

                return [
                    `<button type="button" class="tc-single-card-select-option${selectedClass}"`,
                    ` role="radio" aria-checked="${isSelected}"`,
                    ` tabindex="${tabindex}" data-key="${esc(opt.key)}">`,
                    `<span class="tc-single-card-select-title">${esc(opt.title)}</span>`,
                    descHtml,
                    `<span class="tc-single-card-select-check" aria-hidden="true">${checkIconHtml}</span>`,
                    `</button>`,
                ].join('')
            })
            .join('')

        const name = this.name
        const hiddenInputHtml = name
            ? `<input type="hidden" name="${esc(name)}" value="${esc(value ?? '')}">`
            : ''

        this.innerHTML = cardsHtml + hiddenInputHtml
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SingleCardSelect
    }
}
