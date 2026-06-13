const TAG_NAME = 'tc-badge-row'

export type BadgeRowSize = 'sm' | 'md'
export type BadgeRowVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark'

const SIZES: BadgeRowSize[] = ['sm', 'md']
const VARIANTS: BadgeRowVariant[] = ['primary', 'secondary', 'success', 'danger', 'warning', 'info', 'light', 'dark']

export interface BadgeRowItem {
    label: string
    value?: string | number
    color?: string
    variant?: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class BadgeRow extends HTMLElement {
    private _initialised = false
    private _badges: BadgeRowItem[] = []

    static get observedAttributes(): string[] {
        return ['size']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get badges(): BadgeRowItem[] {
        return this._badges
    }
    set badges(v: BadgeRowItem[]) {
        this._badges = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get size(): BadgeRowSize {
        const v = this.getAttribute('size') as BadgeRowSize
        return SIZES.includes(v) ? v : 'md'
    }
    set size(v: BadgeRowSize) {
        this.setAttribute('size', v)
    }

    private render(): void {
        const size = this.size

        // Manage own classes without wiping user-added ones (className pass-through)
        this.classList.add('tc-badge-row', 'd-flex', 'flex-wrap', 'gap-2')
        SIZES.forEach(s => this.classList.remove(`tc-badge-row--${s}`))
        this.classList.add(`tc-badge-row--${size}`)
        this.setAttribute('role', 'list')

        this.innerHTML = this._badges.map(badge => {
            const variant = badge.variant && (VARIANTS as string[]).includes(badge.variant)
                ? badge.variant
                : null
            const variantClass = variant ? ` tc-badge-row-item--${variant}` : ''
            const colorStyle = badge.color
                ? ` style="--bs-badge-row-color: ${esc(badge.color)}"`
                : ''
            const valueHtml = badge.value != null
                ? `<span class="tc-badge-row-value">${esc(String(badge.value))}</span>`
                : ''
            return `<span class="tc-badge-row-item${variantClass}" role="listitem"${colorStyle}><span class="tc-badge-row-label">${esc(badge.label)}</span>${valueHtml}</span>`
        }).join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: BadgeRow
    }
}
