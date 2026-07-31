import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { closeIcon } from './icons'

const TAG_NAME = 'tc-chip'

export type ChipVariant = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'

const VARIANTS: ChipVariant[] = ['primary', 'secondary', 'info', 'success', 'warning', 'danger']

/**
 * The three container scales the phone design uses, one per place a chip appears:
 * `sm` on a card (`3px 9px` / 10px), `md` on a horizontal rail (`5px 11px` / 11px),
 * `lg` inside a bottom sheet (`6px 12px` / 12px — thumb-sized). Absent keeps the
 * library's own 13px desktop scale.
 */
export type ChipSize = 'sm' | 'md' | 'lg'

const SIZES: ChipSize[] = ['sm', 'md', 'lg']

export class Chip extends HTMLElement {
    private _initialised = false
    private _onRemove: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['selected', 'variant', 'icon', 'count', 'removable', 'disabled', 'static', 'size']
    }

    // Static chips render a non-interactive `<span>` root (no tc-click, no
    // aria-pressed) — this is what tc-tag aliases onto. The tc-tag element always
    // renders static regardless of the attribute.
    private get isStatic(): boolean {
        return this.hasAttribute('static') || this.localName === 'tc-tag'
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-chip-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-chip-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-chip-content')
        if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(v: boolean) {
        if (v) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get variant(): ChipVariant {
        const v = this.getAttribute('variant') as ChipVariant
        return VARIANTS.includes(v) ? v : 'secondary'
    }
    set variant(v: ChipVariant) {
        this.setAttribute('variant', v)
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get count(): string | null {
        return this.getAttribute('count')
    }
    set count(v: string | null) {
        if (v != null) this.setAttribute('count', v)
        else this.removeAttribute('count')
    }

    get removable(): boolean {
        return this.hasAttribute('removable')
    }
    set removable(v: boolean) {
        if (v) this.setAttribute('removable', '')
        else this.removeAttribute('removable')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get onRemove(): (() => void) | null {
        return this._onRemove
    }
    set onRemove(v: (() => void) | null) {
        this._onRemove = v
        if (this._initialised) {
            const inner = this.querySelector('.tc-chip-content')
            const slotContent = inner ? Array.from(inner.childNodes) : []
            this.render()
            const newInner = this.querySelector('.tc-chip-content')
            if (newInner) slotContent.forEach((n) => newInner.appendChild(n))
        }
    }

    private _handleClick = (): void => {
        this.dispatchEvent(
            new CustomEvent('tc-click', {
                bubbles: true,
                composed: true,
            }),
        )
    }

    private _handleRemove = (e: Event): void => {
        e.stopPropagation()
        this.dispatchEvent(
            new CustomEvent('tc-remove', {
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this._onRemove === 'function') this._onRemove()
    }

    get size(): ChipSize | null {
        const v = this.getAttribute('size') as ChipSize
        return SIZES.includes(v) ? v : null
    }
    set size(v: ChipSize | null) {
        if (v != null) this.setAttribute('size', v)
        else this.removeAttribute('size')
    }

    private render(): void {
        const variant = this.variant
        const selected = this.selected
        const iconName = this.getAttribute('icon')
        const count = this.getAttribute('count')
        const disabled = this.disabled
        const isRemovable = this.hasAttribute('removable') || this._onRemove !== null
        const isStatic = this.isStatic

        const selectedClass = selected ? ' is-selected' : ''
        const size = this.size
        const sizeClass = size ? ` tc-chip--${size}` : ''
        // A marker class and not just the host attribute: the coarse-pointer touch
        // floor in _chip.scss exempts static chips (a label is not a target), and it
        // has to make that distinction on `.tc-chip` itself — `tc-tag .tc-chip` and
        // `tc-chip[static] .tc-chip` would be a second, competing floor rather than
        // one floor with one exception.
        const staticClass = isStatic ? ' tc-chip--static' : ''
        const disabledAttr = disabled ? ' disabled' : ''
        // A non-interactive span carries neither aria-pressed nor a type attribute.
        const ariaPressedAttr = isStatic ? '' : ` aria-pressed="${selected}"`
        const rootTag = isStatic ? 'span' : 'button'
        const typeAttr = isStatic ? '' : ' type="button"'

        const iconHtml = iconName
            ? `<span class="tc-chip-icon" aria-hidden="true">${lucideByName(iconName)}</span>`
            : ''

        const countHtml = count != null ? `<span class="tc-chip-count">${esc(count)}</span>` : ''

        const removeHtml = isRemovable
            ? `<button type="button" class="tc-chip-remove" aria-label="Remove"${disabledAttr}>${closeIcon}</button>`
            : ''

        this.innerHTML = `<${rootTag} class="tc-chip tc-chip--${variant}${sizeClass}${staticClass}${selectedClass}"${typeAttr}${ariaPressedAttr}${disabledAttr}>${iconHtml}<span class="tc-chip-content"></span>${countHtml}</${rootTag}>${removeHtml}`

        if (!isStatic) {
            const chipBtn = this.querySelector<HTMLButtonElement>('.tc-chip')
            if (chipBtn) chipBtn.addEventListener('click', this._handleClick)
        }

        if (isRemovable) {
            const removeBtn = this.querySelector('.tc-chip-remove')
            if (removeBtn) removeBtn.addEventListener('click', this._handleRemove)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Chip
    }
}
