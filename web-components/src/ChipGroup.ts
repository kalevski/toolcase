import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-chip-group'

export type ChipGroupItem = {
    id: string
    label: string
    selected?: boolean
    icon?: string
    count?: number | string
    disabled?: boolean
    variant?: string
}

let _idCounter = 0

export class ChipGroup extends HTMLElement {
    private _initialised = false
    private _items: ChipGroupItem[] = []
    private _titleProp: string | Node | null = null
    private _subtitleProp: string | Node | null = null
    private _idPrefix: string
    onToggle: ((id: string) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-cg-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'border', 'layout', 'size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('tc-click', this._onChipClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('tc-click', this._onChipClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | Node) {
        if (v instanceof Node) {
            this._titleProp = v
            if (this._initialised) this.render()
        } else {
            this._titleProp = null
            this.setAttribute('title', String(v ?? ''))
            // attributeChangedCallback handles re-render
        }
    }

    /**
     * `rail` lays the chips out as ONE horizontally scrolling line instead of a
     * wrapping block — screen `1f`'s filter rail. A phone has room for two or three
     * chips per line, so a wrapping row of eight becomes three lines of chrome above
     * the content; scrolling keeps it to one and signals "there are more".
     */
    get layout(): 'wrap' | 'rail' {
        return this.getAttribute('layout') === 'rail' ? 'rail' : 'wrap'
    }
    set layout(v: 'wrap' | 'rail') {
        if (v === 'rail') this.setAttribute('layout', 'rail')
        else this.removeAttribute('layout')
    }

    /** Passed straight to every chip — see `ChipSize`. */
    get size(): string {
        return this.getAttribute('size') ?? ''
    }
    set size(v: string) {
        if (v) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string | Node) {
        if (v instanceof Node) {
            this._subtitleProp = v
            if (this._initialised) this.render()
        } else {
            this._subtitleProp = null
            this.setAttribute('subtitle', String(v ?? ''))
        }
    }

    get items(): ChipGroupItem[] {
        return this._items
    }
    set items(v: ChipGroupItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get border(): boolean {
        return this.hasAttribute('border')
    }
    set border(v: boolean) {
        if (v) this.setAttribute('border', '')
        else this.removeAttribute('border')
    }

    private _onChipClick = (e: Event): void => {
        const chip = (e.target as HTMLElement).closest<HTMLElement>('tc-chip[data-cg-id]')
        if (!chip) return
        const id = chip.getAttribute('data-cg-id') ?? ''
        const item = this._items.find((i) => i.id === id)
        if (!item || item.disabled) return

        item.selected = !item.selected

        // Patch in place — avoids a full re-render so focus is minimally disrupted
        if (item.selected) {
            chip.setAttribute('selected', '')
        } else {
            chip.removeAttribute('selected')
        }

        this.dispatchEvent(
            new CustomEvent('tc-toggle', {
                bubbles: true,
                composed: true,
                detail: { id },
            }),
        )
        if (typeof this.onToggle === 'function') this.onToggle(id)
    }

    private render(): void {
        const hasBorder = this.border
        const borderClass = hasBorder ? ' has-border' : ''
        const titleId = `${this._idPrefix}-title`

        const titleAttr = this.getAttribute('title')
        const subtitleAttr = this.getAttribute('subtitle')
        const hasTitle = this._titleProp != null || (titleAttr != null && titleAttr !== '')
        const hasSubtitle =
            this._subtitleProp != null || (subtitleAttr != null && subtitleAttr !== '')

        let headerHtml = ''
        if (hasTitle || hasSubtitle) {
            const titleSpan = hasTitle
                ? `<span class="tc-chip-group-title" id="${titleId}"></span>`
                : ''
            const subtitleSpan = hasSubtitle ? `<span class="tc-chip-group-subtitle"></span>` : ''
            headerHtml = `<div class="tc-chip-group-header">${titleSpan}${subtitleSpan}</div>`
        }

        const ariaAttr = hasTitle ? ` aria-labelledby="${titleId}"` : ''
        const size = this.size
        // `.tc-scroll-x` is APPLIED, not copied. style/foundation/README.md sanctions
        // exactly three restatements of that utility's declarations (tc-page-tabs,
        // tc-mobile-shell, tc-swipe-pager) and says a fourth means the utility is the
        // wrong shape — the rule there is that a copy exists only where the element is
        // the CONSUMER'S node and a framework would rewrite its className. This div is
        // rendered by this element, so the class survives and no copy is needed.
        const railClass = this.layout === 'rail' ? ' tc-chip-group-items--rail tc-scroll-x' : ''

        const chipsHtml = this._items
            .map((item) => {
                const variantAttr = item.variant ? ` variant="${esc(item.variant)}"` : ''
                const iconAttr = item.icon ? ` icon="${esc(item.icon)}"` : ''
                const countAttr = item.count != null ? ` count="${esc(String(item.count))}"` : ''
                const disabledAttr = item.disabled ? ' disabled' : ''
                const selectedAttr = item.selected ? ' selected' : ''
                const sizeAttr = size ? ` size="${esc(size)}"` : ''
                return `<tc-chip data-cg-id="${esc(item.id)}"${variantAttr}${sizeAttr}${iconAttr}${countAttr}${disabledAttr}${selectedAttr}>${esc(item.label)}</tc-chip>`
            })
            .join('')

        patchHtml(
            this,
            `<div class="tc-chip-group${borderClass}" role="group"${ariaAttr}>${headerHtml}<div class="tc-chip-group-items${railClass}">${chipsHtml}</div></div>`,
        )

        // Populate title with Node or attribute text
        if (hasTitle) {
            const titleEl = this.querySelector('.tc-chip-group-title')
            if (titleEl) {
                if (this._titleProp instanceof Node) {
                    titleEl.appendChild(this._titleProp.cloneNode(true))
                } else {
                    titleEl.textContent = titleAttr ?? ''
                }
            }
        }

        // Populate subtitle with Node or attribute text
        if (hasSubtitle) {
            const subtitleEl = this.querySelector('.tc-chip-group-subtitle')
            if (subtitleEl) {
                if (this._subtitleProp instanceof Node) {
                    subtitleEl.appendChild(this._subtitleProp.cloneNode(true))
                } else {
                    subtitleEl.textContent = subtitleAttr ?? ''
                }
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ChipGroup
    }
}
