const TAG_NAME = 'gc-pause-screen'

export interface PauseScreenItem {
    id: string
    label: string
    disabled?: boolean
    badge?: string
}

const DEFAULT_ITEMS: PauseScreenItem[] = [
    { id: 'resume', label: 'Resume' },
    { id: 'restart', label: 'Restart' },
    { id: 'quit', label: 'Quit' },
]

export interface PauseScreenEventMap {
    resume: CustomEvent<void>
    restart: CustomEvent<void>
    quit: CustomEvent<void>
    select: CustomEvent<{ id: string }>
}

export class PauseScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'screen-title']
    }

    private _items: PauseScreenItem[] = DEFAULT_ITEMS.slice()
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

    get screenTitle(): string {
        return this.getAttribute('screen-title') ?? 'Paused'
    }
    set screenTitle(v: string) {
        if (v) this.setAttribute('screen-title', v)
        else this.removeAttribute('screen-title')
    }

    get items(): PauseScreenItem[] {
        return this._items
    }
    set items(v: PauseScreenItem[]) {
        this._items = Array.isArray(v) && v.length ? v : DEFAULT_ITEMS.slice()
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
            this.emit('resume')
        }
    }

    private dispatchItem(item: PauseScreenItem): void {
        if (item.disabled) return
        if (item.id === 'resume') this.emit('resume')
        else if (item.id === 'restart') this.emit('restart')
        else if (item.id === 'quit') this.emit('quit')
        this.emit('select', { id: item.id })
    }

    private render(): void {
        const itemMarkup = this._items.map((item) => {
            const cls = `gc-pause-screen-item${item.disabled ? ' is-disabled' : ''}`
            const tabindex = item.disabled ? '-1' : '0'
            const disabledAttr = item.disabled ? ' aria-disabled="true"' : ''
            const badgeMarkup = item.badge
                ? `<span class="gc-pause-screen-badge">${this.escape(item.badge)}</span>`
                : ''
            return `<div role="menuitem" tabindex="${tabindex}"${disabledAttr} class="${cls}" data-id="${this.escape(item.id)}"><span class="gc-pause-screen-label">${this.escape(item.label)}</span>${badgeMarkup}</div>`
        }).join('')

        this.innerHTML = `
            <div class="gc-pause-screen-backdrop" data-gc-backdrop></div>
            <div class="gc-pause-screen-panel" role="document">
                <gc-eyebrow class="gc-pause-screen-eyebrow">Game Paused</gc-eyebrow>
                <gc-title class="gc-pause-screen-title">${this.escape(this.screenTitle)}</gc-title>
                <div class="gc-pause-screen-divider"><span class="gc-pause-screen-rule"></span><span class="gc-pause-screen-diamond"></span><span class="gc-pause-screen-rule"></span></div>
                <div class="gc-pause-screen-items" role="menu">${itemMarkup}</div>
            </div>
        `

        const backdrop = this.querySelector('[data-gc-backdrop]') as HTMLElement | null
        backdrop?.addEventListener('click', () => this.emit('resume'))

        this.querySelectorAll<HTMLElement>('.gc-pause-screen-item').forEach((el) => {
            const handle = () => {
                const id = el.dataset.id || ''
                const item = this._items.find((i) => i.id === id)
                if (!item) return
                this.dispatchItem(item)
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

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PauseScreen
    }
}
