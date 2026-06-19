import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-menu-item'

export class MenuItem extends HTMLElement {
    private _initialised = false

    /** Optional callback fired alongside `tc-select`. */
    onSelect: ((label: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['label', 'hotkey', 'icon', 'selected', 'disabled']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'menuitem')
            this._initialised = true
        }
        this.render()
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

    get label(): string {
        return this.getAttribute('label') ?? ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get hotkey(): string {
        return this.getAttribute('hotkey') ?? ''
    }
    set hotkey(value: string) {
        if (value) this.setAttribute('hotkey', value)
        else this.removeAttribute('hotkey')
    }

    // NOTE: `icon` does not collide with any HTMLElement native property (unlike
    // `title` or `role`), so the getter/setter is safe here.
    get icon(): string {
        return this.getAttribute('icon') ?? ''
    }
    set icon(value: string) {
        if (value) this.setAttribute('icon', value)
        else this.removeAttribute('icon')
    }

    get selected(): boolean {
        return this.hasAttribute('selected')
    }
    set selected(value: boolean) {
        if (value) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(value: boolean) {
        if (value) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _onClick = (): void => {
        if (this.disabled) return
        this._emitSelect()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        if (this.disabled) return
        e.preventDefault()
        this._emitSelect()
    }

    private _emitSelect(): void {
        const label = this.label
        this.dispatchEvent(
            new CustomEvent('tc-select', {
                bubbles: true,
                composed: true,
                detail: { label },
            }),
        )
        if (typeof this.onSelect === 'function') this.onSelect(label)
    }

    private render(): void {
        const label = this.label
        const hotkey = this.hotkey
        const iconName = this.icon
        const selected = this.selected
        const disabled = this.disabled

        // Host modifier classes — use classList to preserve any author-added classes
        this.classList.toggle('tc-menu-item--selected', selected)
        this.classList.toggle('tc-menu-item--disabled', disabled)

        // ARIA state
        if (selected) this.setAttribute('aria-current', 'true')
        else this.removeAttribute('aria-current')

        if (disabled) {
            this.setAttribute('aria-disabled', 'true')
            this.removeAttribute('tabindex')
        } else {
            this.removeAttribute('aria-disabled')
            this.setAttribute('tabindex', '0')
        }

        // Build inner HTML
        const parts: string[] = []

        if (iconName) {
            const iconHtml = lucideByName(iconName)
            if (iconHtml) {
                parts.push(`<span class="tc-menu-item-icon" aria-hidden="true">${iconHtml}</span>`)
            }
        }

        parts.push(`<span class="tc-menu-item-label">${esc(label)}</span>`)

        if (hotkey) {
            parts.push(`<kbd class="tc-menu-item-hotkey">${esc(hotkey)}</kbd>`)
        }

        this.innerHTML = parts.join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MenuItem
    }
}
