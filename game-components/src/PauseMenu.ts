const TAG_NAME = 'gc-pause-menu'

export interface PauseMenuItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

export interface PauseMenuEventMap {
    resume: CustomEvent<void>
    close: CustomEvent<void>
    select: CustomEvent<{ id: string }>
}

export class PauseMenu extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'menu-title']
    }

    private _items: PauseMenuItem[] = []
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')
        this.setAttribute('aria-modal', 'true')
        document.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get menuTitle(): string {
        return this.getAttribute('menu-title') ?? ''
    }
    set menuTitle(value: string) {
        if (value) this.setAttribute('menu-title', value)
        else this.removeAttribute('menu-title')
    }

    get items(): PauseMenuItem[] {
        return this._items
    }
    set items(value: PauseMenuItem[]) {
        this._items = Array.isArray(value) ? value : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private handleKey(event: KeyboardEvent): void {
        if (!this.open) return
        if (event.key === 'Escape') {
            event.preventDefault()
            this.emit('close')
        }
    }

    private render(): void {
        const title = this.menuTitle || 'Paused'
        const itemMarkup = this._items.map((item) => {
            const cls = `gc-pause-menu-item${item.disabled ? ' is-disabled' : ''}`
            const disabledAttr = item.disabled ? ' aria-disabled="true"' : ''
            const tabindex = item.disabled ? '-1' : '0'
            const badgeMarkup = item.badge
                ? `<span class="gc-pause-menu-badge">${this.escape(item.badge)}</span>`
                : ''
            return `<div role="menuitem" tabindex="${tabindex}"${disabledAttr} class="${cls}" data-id="${this.escape(item.id)}"><span class="gc-pause-menu-label">${this.escape(item.label)}</span>${badgeMarkup}</div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-pause-menu-backdrop" data-gc-backdrop></div>
            <div class="gc-pause-menu-panel" role="document">
                <gc-eyebrow class="gc-pause-menu-eyebrow">Game Paused</gc-eyebrow>
                <gc-title class="gc-pause-menu-title">${this.escape(title)}</gc-title>
                <div class="gc-pause-menu-divider"><span class="gc-pause-menu-rule"></span><span class="gc-pause-menu-diamond"></span><span class="gc-pause-menu-rule"></span></div>
                <div class="gc-pause-menu-items" role="menu">${itemMarkup}</div>
                <div class="gc-pause-menu-footer">
                    <gc-metal-button class="gc-pause-menu-resume" variant="primary">Resume</gc-metal-button>
                </div>
            </div>
        `

        const backdrop = this.querySelector('[data-gc-backdrop]') as HTMLElement | null
        backdrop?.addEventListener('click', () => this.emit('close'))

        const resume = this.querySelector('.gc-pause-menu-resume') as HTMLElement | null
        resume?.addEventListener('click', () => this.emit('resume'))

        this.querySelectorAll<HTMLElement>('.gc-pause-menu-item').forEach((el) => {
            const handle = () => {
                const id = el.dataset.id || ''
                const item = this._items.find((i) => i.id === id)
                if (!item || item.disabled) return
                this.emit('select', { id })
            }
            el.addEventListener('click', handle)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                handle()
            })
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PauseMenu)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PauseMenu
    }
}
