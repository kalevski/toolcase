const TAG_NAME = 'gc-menu-item'

export interface MenuItemEventMap {
    select: CustomEvent<{ label: string }>
}

export class MenuItem extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['label', 'hotkey', 'icon', 'selected', 'disabled']
    }

    private root: ShadowRoot
    private clickHandler = (event: Event) => this.handleClick(event)
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'menuitem')
        this.updateState()
        this.addEventListener('click', this.clickHandler, true)
        this.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this.clickHandler, true)
        this.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected) return
        this.updateState()
        this.render()
    }

    get label(): string {
        return this.getAttribute('label') || ''
    }
    set label(value: string) {
        if (value) this.setAttribute('label', value)
        else this.removeAttribute('label')
    }

    get hotkey(): string {
        return this.getAttribute('hotkey') || ''
    }
    set hotkey(value: string) {
        if (value) this.setAttribute('hotkey', value)
        else this.removeAttribute('hotkey')
    }

    get icon(): string {
        return this.getAttribute('icon') || ''
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

    private updateState(): void {
        if (this.disabled) {
            this.setAttribute('aria-disabled', 'true')
            this.removeAttribute('tabindex')
        } else {
            this.removeAttribute('aria-disabled')
            this.setAttribute('tabindex', '0')
        }
        if (this.selected) this.setAttribute('aria-current', 'true')
        else this.removeAttribute('aria-current')
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private handleClick(event: Event): void {
        if (this.disabled) {
            event.stopImmediatePropagation()
            event.preventDefault()
            return
        }
        this.emit('select', { label: this.label })
    }

    private handleKey(event: KeyboardEvent): void {
        if (this.disabled) return
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        this.click()
    }

    private render(): void {
        const icon = this.icon
        const label = this.label
        const hotkey = this.hotkey
        const parts: string[] = []

        if (this.selected) {
            parts.push(`<span class="gc-menu-item-caret">◆</span>`)
        }

        if (icon) {
            if (icon.startsWith('bi-') || icon.startsWith('bi ')) {
                const cls = icon.startsWith('bi ') ? icon : `bi ${icon}`
                parts.push(`<i class="gc-menu-item-icon ${this.escape(cls)}"></i>`)
            } else {
                parts.push(`<span class="gc-menu-item-icon">${this.escape(icon)}</span>`)
            }
        }

        parts.push(`<span class="gc-menu-item-label">${this.escape(label)}</span>`)

        if (hotkey) {
            parts.push(`<gc-key class="gc-menu-item-hotkey">${this.escape(hotkey)}</gc-key>`)
        }

        this.innerHTML = parts.join('')
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MenuItem
    }
}
