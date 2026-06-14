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

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
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
        return ['title', 'subtitle', 'border']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this.addEventListener('tc-click', this._onChipClick)
            this._initialised = true
        }
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
    // @ts-ignore — intentionally widens setter to accept Node alongside string
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
        const item = this._items.find(i => i.id === id)
        if (!item || item.disabled) return

        item.selected = !item.selected

        // Patch in place — avoids a full re-render so focus is minimally disrupted
        if (item.selected) {
            chip.setAttribute('selected', '')
        } else {
            chip.removeAttribute('selected')
        }

        this.dispatchEvent(new CustomEvent('tc-toggle', {
            bubbles: true,
            composed: true,
            detail: { id },
        }))
        if (typeof this.onToggle === 'function') this.onToggle(id)
    }

    private render(): void {
        const hasBorder = this.border
        const borderClass = hasBorder ? ' has-border' : ''
        const titleId = `${this._idPrefix}-title`

        const titleAttr = this.getAttribute('title')
        const subtitleAttr = this.getAttribute('subtitle')
        const hasTitle = this._titleProp != null || (titleAttr != null && titleAttr !== '')
        const hasSubtitle = this._subtitleProp != null || (subtitleAttr != null && subtitleAttr !== '')

        let headerHtml = ''
        if (hasTitle || hasSubtitle) {
            const titleSpan = hasTitle
                ? `<span class="tc-chip-group-title" id="${titleId}"></span>`
                : ''
            const subtitleSpan = hasSubtitle
                ? `<span class="tc-chip-group-subtitle"></span>`
                : ''
            headerHtml = `<div class="tc-chip-group-header">${titleSpan}${subtitleSpan}</div>`
        }

        const ariaAttr = hasTitle ? ` aria-labelledby="${titleId}"` : ''

        const chipsHtml = this._items.map(item => {
            const variantAttr = item.variant ? ` variant="${esc(item.variant)}"` : ''
            const iconAttr = item.icon ? ` icon="${esc(item.icon)}"` : ''
            const countAttr = item.count != null ? ` count="${esc(String(item.count))}"` : ''
            const disabledAttr = item.disabled ? ' disabled' : ''
            const selectedAttr = item.selected ? ' selected' : ''
            return `<tc-chip data-cg-id="${esc(item.id)}"${variantAttr}${iconAttr}${countAttr}${disabledAttr}${selectedAttr}>${esc(item.label)}</tc-chip>`
        }).join('')

        this.innerHTML = `<div class="tc-chip-group${borderClass}" role="group"${ariaAttr}>${headerHtml}<div class="tc-chip-group-items">${chipsHtml}</div></div>`

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
