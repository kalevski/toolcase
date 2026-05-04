import type { LootEntry } from './LootList'

const TAG_NAME = 'gc-loot-popup'

export interface LootPopupEventMap {
    take: CustomEvent<{ id: string }>
    'take-all': CustomEvent<void>
    discard: CustomEvent<void>
    close: CustomEvent<void>
}

export class LootPopup extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'popup-title', 'eyebrow', 'discard-label', 'auto-fade-ms']
    }

    private _items: LootEntry[] = []
    private fadeTimer: number | null = null
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')
        this.setAttribute('aria-modal', 'true')
        document.addEventListener('keydown', this.keyHandler)
        this.render()
        this.scheduleAutoFade()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
        this.clearAutoFade()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        this.render()
        if (name === 'open' || name === 'auto-fade-ms') {
            this.scheduleAutoFade()
        }
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get popupTitle(): string {
        return this.getAttribute('popup-title') ?? 'Loot'
    }
    set popupTitle(v: string) {
        if (v) this.setAttribute('popup-title', v)
        else this.removeAttribute('popup-title')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Acquired'
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get discardLabel(): string {
        return this.getAttribute('discard-label') ?? 'Discard'
    }
    set discardLabel(v: string) {
        if (v) this.setAttribute('discard-label', v)
        else this.removeAttribute('discard-label')
    }

    get autoFadeMs(): number {
        const raw = this.getAttribute('auto-fade-ms')
        if (raw === null) return 0
        const parsed = Number(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
    set autoFadeMs(v: number) {
        if (Number.isFinite(v) && v > 0) this.setAttribute('auto-fade-ms', String(v))
        else this.removeAttribute('auto-fade-ms')
    }

    get items(): LootEntry[] {
        return this._items.slice()
    }
    set items(value: LootEntry[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) {
            this.syncItemsToList()
            this.scheduleAutoFade()
        }
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

    private clearAutoFade(): void {
        if (this.fadeTimer !== null) {
            window.clearTimeout(this.fadeTimer)
            this.fadeTimer = null
        }
    }

    private scheduleAutoFade(): void {
        this.clearAutoFade()
        if (!this.open) return
        const ms = this.autoFadeMs
        if (ms <= 0) return
        this.fadeTimer = window.setTimeout(() => {
            this.fadeTimer = null
            this.emit('close')
        }, ms)
    }

    private syncItemsToList(): void {
        const list = this.querySelector('gc-loot-list') as HTMLElement & { items?: LootEntry[] } | null
        if (list) list.items = this._items.slice()
    }

    private render(): void {
        const eyebrowText = this.escape(this.eyebrow)
        const titleText = this.escape(this.popupTitle)
        const discardText = this.escape(this.discardLabel)
        const eyebrowMarkup = this.eyebrow
            ? `<gc-eyebrow class="gc-loot-popup-eyebrow">${eyebrowText}</gc-eyebrow>`
            : ''

        this.innerHTML = `
            <div class="gc-loot-popup-backdrop" data-gc-backdrop></div>
            <div class="gc-loot-popup-panel" role="document">
                ${eyebrowMarkup}
                <gc-title class="gc-loot-popup-title">${titleText}</gc-title>
                <div class="gc-loot-popup-divider"><span class="gc-loot-popup-rule"></span><span class="gc-loot-popup-diamond"></span><span class="gc-loot-popup-rule"></span></div>
                <gc-loot-list class="gc-loot-popup-list" list-title=""></gc-loot-list>
                <div class="gc-loot-popup-actions">
                    <gc-metal-button class="gc-loot-popup-discard" variant="ghost">${discardText}</gc-metal-button>
                    <gc-metal-button class="gc-loot-popup-take-all" variant="primary">Take All</gc-metal-button>
                </div>
            </div>
        `

        this.syncItemsToList()

        const backdrop = this.querySelector('[data-gc-backdrop]') as HTMLElement | null
        backdrop?.addEventListener('click', () => this.emit('close'))

        const list = this.querySelector('gc-loot-list')
        list?.addEventListener('take', (event) => {
            const detail = (event as CustomEvent<{ id: string }>).detail
            this.emit('take', detail)
            this.scheduleAutoFade()
        })
        list?.addEventListener('take-all', () => {
            this.emit('take-all')
        })

        const takeAll = this.querySelector('.gc-loot-popup-take-all') as HTMLElement | null
        takeAll?.addEventListener('click', () => this.emit('take-all'))

        const discard = this.querySelector('.gc-loot-popup-discard') as HTMLElement | null
        discard?.addEventListener('click', () => this.emit('discard'))
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LootPopup
    }
}
