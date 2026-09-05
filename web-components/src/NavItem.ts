import { bindOnce, patchHtml } from './internal/patch-html'
import { consumerText, observeContent } from './internal/content-observer'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import { Tab as BsTab } from './internal/Tab'

const TAG_NAME = 'tc-nav-item'

export class NavItem extends HTMLElement {
    private _bsTab: BsTab | null = null
    private _anchorEl: HTMLAnchorElement | null = null
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['href', 'target', 'active', 'disabled']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
        // The accessible name is a copy of the consumer's label text, so it has to
        // follow that text when React rewrites it — see content-observer.ts.
        observeContent(this, () => this.render())
        this._initPlugin()
    }

    disconnectedCallback(): void {
        this._teardown()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._teardown()
        this.render()
        this._initPlugin()
    }

    _parentVariantChanged(): void {
        if (!this.isConnected || !this._initialised) return
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

        const linkClasses = ['nav-link']
        if (active) linkClasses.push('active')
        if (disabled) linkClasses.push('disabled')

        // THE HOST IS THE ITEM. The anchor keeps every link behaviour and the tab
        // plugin's hook, but it is stretched over the host rather than wrapped
        // around the label the consumer wrote (rule 1).
        setHostClass(this, `nav-item ${linkClasses.join(' ')}`)

        const label = consumerText(this)
        const attrs = [
            `href="${esc(href)}"`,
            'class="nav-link tc-hit-overlay"',
            target ? `target="${esc(target)}"` : '',
            toggleType ? `data-bs-toggle="${toggleType}"` : '',
            toggleType && active ? 'aria-selected="true"' : '',
            !toggleType && active ? 'aria-current="page"' : '',
            disabled ? 'aria-disabled="true"' : '',
            label ? `aria-label="${esc(label)}"` : '',
        ]
            .filter(Boolean)
            .join(' ')
        patchHtml(this, `<a ${attrs}></a>`)
        this._anchorEl = this.querySelector<HTMLAnchorElement>(':scope > a.nav-link')
    }

    private _initPlugin(): void {
        const a = this._anchorEl
        if (!a) return
        const toggle = a.getAttribute('data-bs-toggle')
        if (toggle !== 'tab' && toggle !== 'pill') return
        this._bsTab = new BsTab(a)
        bindOnce(a, 'show.bs.tab', this._onShow)
        bindOnce(a, 'shown.bs.tab', this._onShown)
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
