import { patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-settings-category-list'

export interface SettingsCategory {
    id: string
    label: string
    /** Lucide icon name (kebab-case) or any text / emoji fallback. */
    icon?: string
}

export class SettingsCategoryList extends HTMLElement {
    private _initialised = false
    private _categories: SettingsCategory[] = []

    /** Optional callback fired alongside `tc-select`. */
    onSelect: ((id: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected-id']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this._ensureSkeleton()
            this._adopt(slotContent)
            this._initialised = true
        }
        this._renderNav()
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'selected-id') {
            // Surgical patch — only update classes/tabindex, don't rebuild nav.
            this._patchNavSelection()
            return
        }
    }

    get categories(): SettingsCategory[] {
        return this._categories.slice()
    }
    set categories(value: SettingsCategory[]) {
        this._categories = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this._renderNav()
    }

    get selectedId(): string {
        return this.getAttribute('selected-id') ?? ''
    }
    set selectedId(value: string) {
        if (value) this.setAttribute('selected-id', value)
        else this.removeAttribute('selected-id')
    }

    /**
     * Build the permanent nav column + an (initially empty) body column once.
     * The body column has to be a single real element — not the consumer's raw
     * children left as direct siblings of nav — because CSS grid places each
     * direct child in its OWN cell: with more than one body child, odd-indexed
     * ones would land back in the narrow nav column on a new row instead of
     * flowing under the wide column. `adoptChildren` (see adopt-children.ts) is
     * what makes moving them into that div safe for react-dom (rule 1's one
     * sanctioned exception) — a raw `body.appendChild(child)` here is what used
     * to make `removeChild` throw.
     */
    private _ensureSkeleton(): void {
        this.setAttribute('role', 'tabpanel')
        patchHtml(
            this,
            '<nav data-tc-settings-nav role="tablist" aria-label="Settings categories"' +
                ' class="tc-settings-category-list-nav"></nav>' +
                '<div class="tc-settings-category-list-body" data-tc-settings-body></div>',
        )
    }

    /** The consumer's own children are the body content — see adopt-children.ts. */
    private _adopt(nodes?: Node[]): void {
        const body = this.querySelector<HTMLElement>('[data-tc-settings-body]')
        if (body) adoptChildren(this, () => body, nodes)
    }

    /** Rebuild the full nav list from `categories` (called on initial render and when categories change). */
    private _renderNav(): void {
        const nav = this.querySelector<HTMLElement>('[data-tc-settings-nav]')
        if (!nav) return
        const selected = this.selectedId
        nav.innerHTML = this._categories
            .map((cat) => {
                const isSelected = cat.id === selected
                const cls = `tc-settings-category-list-item${isSelected ? ' tc-settings-category-list-item--active' : ''}`
                let iconHtml = ''
                if (cat.icon) {
                    // Pass the sizing class so icon() keeps a hook for the CSS
                    // width/height rule — without it the stripped SVG has no
                    // dimensions and renders at the wrong size / invisibly.
                    const lucide = lucideByName(cat.icon, 'tc-settings-category-list-icon')
                    iconHtml = lucide
                        ? `<span class="tc-settings-category-list-icon-wrap" aria-hidden="true">${lucide}</span>`
                        : `<span class="tc-settings-category-list-icon-wrap tc-settings-category-list-icon-wrap--text" aria-hidden="true">${esc(cat.icon)}</span>`
                }
                return (
                    `<button type="button" role="tab" tabindex="${isSelected ? '0' : '-1'}" aria-selected="${isSelected}" class="${cls}" data-id="${esc(cat.id)}">` +
                    iconHtml +
                    `<span class="tc-settings-category-list-label">${esc(cat.label)}</span>` +
                    `</button>`
                )
            })
            .join('')
    }

    /**
     * Surgically update selected state on existing nav buttons without rebuilding innerHTML.
     * Called when `selected-id` changes — preserves focus.
     */
    private _patchNavSelection(): void {
        const selected = this.selectedId
        this.querySelectorAll<HTMLElement>('[data-tc-settings-nav] [data-id]').forEach((btn) => {
            const isSelected = btn.dataset.id === selected
            btn.classList.toggle('tc-settings-category-list-item--active', isSelected)
            btn.setAttribute('aria-selected', String(isSelected))
            btn.setAttribute('tabindex', isSelected ? '0' : '-1')
        })
    }

    private _select(id: string): void {
        if (!id || id === this.selectedId) return
        this.selectedId = id
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(id)
    }

    private _onClick = (e: Event): void => {
        const target = (e.target as Element).closest<HTMLElement>('[data-id]')
        if (!target || !this.contains(target)) return
        const id = target.dataset.id
        if (id) this._select(id)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element
        if (!target.closest('[data-tc-settings-nav]')) return
        const buttons = Array.from(
            this.querySelectorAll<HTMLElement>('[data-tc-settings-nav] [data-id]'),
        )
        if (buttons.length === 0) return
        const idx = buttons.indexOf(target as HTMLElement)

        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault()
            buttons[(idx + 1) % buttons.length].focus()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault()
            buttons[(idx - 1 + buttons.length) % buttons.length].focus()
        } else if (e.key === 'Home') {
            e.preventDefault()
            buttons[0].focus()
        } else if (e.key === 'End') {
            e.preventDefault()
            buttons[buttons.length - 1].focus()
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const id = (target as HTMLElement).dataset.id
            if (id) this._select(id)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SettingsCategoryList
    }
}
