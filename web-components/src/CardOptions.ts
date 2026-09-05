import { bindOnce, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-card-options'

export interface CardOption {
    key: string
    label: string
    description?: string
    /** Lucide icon name, kebab-case or PascalCase (e.g. "shield-check" / "ShieldCheck"). */
    icon?: string
    /** Image src URL. Used when icon is absent. */
    image?: string
}

// Pre-compute the check icon — it is always present in every card (hidden via opacity).
const checkIconHtml = lucideByName('check')

export class CardOptions extends HTMLElement {
    private _initialised = false
    private _options: CardOption[] = []

    /** Optional callback fired alongside the `tc-change` CustomEvent. */
    onChange: ((key: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'columns']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Set default accessible label once; the browser reads this directly
            // from the attribute, so no re-render is needed when it changes.
            if (!this.hasAttribute('aria-label')) {
                this.setAttribute('aria-label', 'Options')
            }
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            this._updateSelection()
        } else {
            this.render()
        }
    }

    get options(): CardOption[] {
        return this._options
    }
    set options(v: CardOption[]) {
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

    get columns(): number {
        return Math.max(1, parseInt(this.getAttribute('columns') ?? '3', 10) || 3)
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    private _select(key: string): void {
        const prev = this.value
        this.setAttribute('value', key)
        if (key !== prev) {
            this.dispatchEvent(
                new CustomEvent('tc-change', {
                    bubbles: true,
                    composed: true,
                    detail: { key },
                }),
            )
            if (typeof this.onChange === 'function') this.onChange(key)
        }
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const cards = Array.from(this.querySelectorAll<HTMLElement>('[role="radio"]'))
        if (cards.length === 0) return
        const idx = cards.indexOf(document.activeElement as HTMLElement)
        if (idx < 0) return

        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault()
            const next = (idx + 1) % cards.length
            this._moveFocus(cards, next)
            this._select(this._options[next].key)
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = (idx - 1 + cards.length) % cards.length
            this._moveFocus(cards, prev)
            this._select(this._options[prev].key)
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            if (idx < this._options.length) {
                this._select(this._options[idx].key)
            }
        }
    }

    private _moveFocus(cards: HTMLElement[], idx: number): void {
        cards.forEach((c, i) => c.setAttribute('tabindex', i === idx ? '0' : '-1'))
        cards[idx].focus()
    }

    private _updateSelection(): void {
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
    }

    private render(): void {
        const value = this.value
        const columns = this.columns

        this.classList.add('tc-card-options')
        // Note: do not define a JS getter/setter for `role` — it conflicts with
        // ARIAMixin.role. Use setAttribute only.
        this.setAttribute('role', 'radiogroup')
        this.style.setProperty('--bs-card-options-columns', String(columns))

        const selectedIdx = this._options.findIndex((o) => o.key === value)

        patchHtml(
            this,
            this._options
                .map((opt, idx) => {
                    const isSelected = opt.key === value
                    const tabindex = isSelected || (selectedIdx < 0 && idx === 0) ? '0' : '-1'
                    const selectedClass = isSelected ? ' is-selected' : ''

                    let mediaHtml = ''
                    if (opt.icon) {
                        const iconSvg = lucideByName(opt.icon)
                        if (iconSvg)
                            mediaHtml = `<span class="tc-card-options-icon">${iconSvg}</span>`
                    } else if (opt.image) {
                        mediaHtml = `<img class="tc-card-options-image" src="${esc(opt.image)}" alt="" aria-hidden="true">`
                    }

                    const descHtml = opt.description
                        ? `<span class="tc-card-options-desc">${esc(opt.description)}</span>`
                        : ''

                    return [
                        `<div class="tc-card-options-card${selectedClass}"`,
                        ` role="radio" aria-checked="${isSelected}"`,
                        ` tabindex="${tabindex}" data-key="${esc(opt.key)}">`,
                        mediaHtml,
                        `<span class="tc-card-options-label">${esc(opt.label)}</span>`,
                        descHtml,
                        `<span class="tc-card-options-check" aria-hidden="true">${checkIconHtml}</span>`,
                        `</div>`,
                    ].join('')
                })
                .join(''),
        )

        Array.from(this.querySelectorAll<HTMLElement>('[role="radio"]')).forEach((card) => {
            bindOnce(card, 'click', () => {
                const key = card.dataset.key
                if (key == null) return
                const all = Array.from(this.querySelectorAll<HTMLElement>('[role="radio"]'))
                this._moveFocus(all, all.indexOf(card))
                this._select(key)
            })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CardOptions
    }
}
