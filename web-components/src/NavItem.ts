import { Tab as BsTab } from './internal/Tab'

const TAG_NAME = 'tc-nav-item'

export class NavItem extends HTMLElement {
    private _bsTab: BsTab | null = null
    private _anchorEl: HTMLAnchorElement | null = null
    private _slotContent: Node[] = []
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['href', 'target', 'active', 'disabled']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._slotContent = Array.from(this.childNodes)
            this._initialised = true
        } else {
            const existing = this.querySelector<HTMLAnchorElement>('a.nav-link')
            if (existing) this._slotContent = Array.from(existing.childNodes)
        }
        this.render()
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const existing = this.querySelector<HTMLAnchorElement>('a.nav-link')
        if (existing) this._slotContent = Array.from(existing.childNodes)
        this._teardown()
        this.render()
        this._initPlugin()
    }

    _parentVariantChanged(): void {
        if (!this.isConnected || !this._initialised) return
        const existing = this.querySelector<HTMLAnchorElement>('a.nav-link')
        if (existing) this._slotContent = Array.from(existing.childNodes)
        this._teardown()
        this.render()
        this._initPlugin()
    }

    get href(): string | null {
        return this.getAttribute('href')
    }
    set href(v: string | null) {
        if (v != null) this.setAttribute('href', v)
        else this.removeAttribute('href')
    }

    get target(): string | null {
        return this.getAttribute('target')
    }
    set target(v: string | null) {
        if (v != null) this.setAttribute('target', v)
        else this.removeAttribute('target')
    }

    get active(): boolean {
        return this.hasAttribute('active')
    }
    set active(v: boolean) {
        if (v) this.setAttribute('active', '')
        else this.removeAttribute('active')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    private _getToggleType(): 'tab' | 'pill' | null {
        const parentNav = this.closest('tc-nav')
        if (!parentNav) return null
        const variant = parentNav.getAttribute('variant')
        if (variant === 'tabs') return 'tab'
        if (variant === 'pills') return 'pill'
        return null
    }

    private _onShow = (): void => {
        this.dispatchEvent(new CustomEvent('tc-show', { bubbles: true, composed: true }))
    }

    private _onShown = (): void => {
        this.dispatchEvent(new CustomEvent('tc-shown', { bubbles: true, composed: true }))
    }

    private render(): void {
        const active = this.hasAttribute('active')
        const disabled = this.hasAttribute('disabled')
        const href = this.getAttribute('href') ?? '#'
        const target = this.getAttribute('target')
        const toggleType = this._getToggleType()

        this.classList.add('nav-item')

        const linkClasses = ['nav-link']
        if (active) linkClasses.push('active')
        if (disabled) linkClasses.push('disabled')

        const a = document.createElement('a')
        a.className = linkClasses.join(' ')
        a.setAttribute('href', href)
        if (target) a.target = target
        if (toggleType) {
            a.setAttribute('data-bs-toggle', toggleType)
            if (active) a.setAttribute('aria-selected', 'true')
        } else if (active) {
            a.setAttribute('aria-current', 'page')
        }
        if (disabled) a.setAttribute('aria-disabled', 'true')

        this.innerHTML = ''
        this.appendChild(a)
        this._slotContent.forEach((n) => a.appendChild(n))
        this._anchorEl = a
    }

    private _initPlugin(): void {
        const a = this._anchorEl
        if (!a) return
        const toggle = a.getAttribute('data-bs-toggle')
        if (toggle !== 'tab' && toggle !== 'pill') return
        this._bsTab = new BsTab(a)
        a.addEventListener('show.bs.tab', this._onShow)
        a.addEventListener('shown.bs.tab', this._onShown)
    }

    private _teardown(): void {
        const a = this._anchorEl
        if (a) {
            a.removeEventListener('show.bs.tab', this._onShow)
            a.removeEventListener('shown.bs.tab', this._onShown)
        }
        if (this._bsTab) {
            this._bsTab.dispose()
            this._bsTab = null
        }
        this._anchorEl = null
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: NavItem
    }
}
