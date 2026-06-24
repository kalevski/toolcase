import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-perk-picker'

export interface Perk {
    id: string
    name: string
    description?: string
    icon?: string
    selected?: boolean
    locked?: boolean
}

export interface PerkPickerEventMap {
    'tc-select': CustomEvent<{ id: string }>
}

// Locked cards always show a lucide lock glyph — never emoji per design rules.
const lockIconHtml = lucideByName('lock')

export class PerkPicker extends HTMLElement {
    private _initialised = false
    private _perks: Perk[] = []

    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['columns']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.setAttribute('role', 'listbox')
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

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get columns(): number {
        const raw = this.getAttribute('columns')
        if (raw == null) return 3
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 3
    }
    set columns(v: number) {
        this.setAttribute('columns', String(v))
    }

    get perks(): Perk[] {
        return this._perks.slice()
    }
    set perks(value: Perk[]) {
        this._perks = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private _perkFor(target: EventTarget | null): { el: HTMLElement; id: string } | null {
        if (!(target instanceof HTMLElement)) return null
        const el = target.closest<HTMLElement>('.tc-perk-picker-card')
        if (!el || !this.contains(el)) return null
        if (el.getAttribute('aria-disabled') === 'true') return null
        const id = el.dataset.id
        if (!id) return null
        return { el, id }
    }

    private _select(id: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-select', { bubbles: true, composed: true, detail: { id } }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _onClick = (e: MouseEvent): void => {
        const hit = this._perkFor(e.target)
        if (!hit) return
        this._select(hit.id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const hit = this._perkFor(e.target)
        if (!hit) return
        e.preventDefault()
        this._select(hit.id)
    }

    private _iconMarkup(perk: Perk): string {
        if (perk.locked) {
            return `<span class="tc-perk-picker-card-icon" aria-hidden="true">${lockIconHtml}</span>`
        }
        if (perk.icon) {
            const lucideHtml = lucideByName(perk.icon)
            if (lucideHtml) {
                return `<span class="tc-perk-picker-card-icon" aria-hidden="true">${lucideHtml}</span>`
            }
            // Not a lucide name — render as a text glyph (e.g. short abbreviation or initials).
            return `<span class="tc-perk-picker-card-icon tc-perk-picker-card-icon--text" aria-hidden="true">${esc(perk.icon.slice(0, 2))}</span>`
        }
        return ''
    }

    private render(): void {
        this.classList.add('tc-perk-picker')
        this.style.setProperty('--bs-perk-picker-columns', String(this.columns))

        const cardsMarkup = this._perks
            .map((p) => {
                const classes = ['tc-perk-picker-card']
                if (p.selected) classes.push('is-selected')
                if (p.locked) classes.push('is-locked')
                const descMarkup = p.description
                    ? `<span class="tc-perk-picker-card-description">${esc(p.description)}</span>`
                    : ''
                return `<div role="option" class="${classes.join(' ')}" tabindex="${p.locked ? '-1' : '0'}" data-id="${esc(p.id)}" aria-selected="${p.selected ? 'true' : 'false'}" aria-disabled="${p.locked ? 'true' : 'false'}">
                ${this._iconMarkup(p)}
                <span class="tc-perk-picker-card-name">${esc(p.name)}</span>
                ${descMarkup}
            </div>`
            })
            .join('')

        this.innerHTML = `<div class="tc-perk-picker-grid">${cardsMarkup}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PerkPicker
    }
}
