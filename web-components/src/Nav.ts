import { setHostClass } from './internal/host-class'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-nav'

export class Nav extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['variant', 'fill', 'justified', 'vertical']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get variant(): string {
        return this.getAttribute('variant') ?? ''
    }
    set variant(v: string) {
        setAttr(this, 'variant', v)
    }

    get fill(): boolean {
        return this.hasAttribute('fill')
    }
    set fill(v: boolean) {
        if (v) this.setAttribute('fill', '')
        else this.removeAttribute('fill')
    }

    get justified(): boolean {
        return this.hasAttribute('justified')
    }
    set justified(v: boolean) {
        if (v) this.setAttribute('justified', '')
        else this.removeAttribute('justified')
    }

    get vertical(): boolean {
        return this.hasAttribute('vertical')
    }
    set vertical(v: boolean) {
        if (v) this.setAttribute('vertical', '')
        else this.removeAttribute('vertical')
    }

    private _syncNavItems(): void {
        this.querySelectorAll('tc-nav-item').forEach((item: any) => {
            item._parentVariantChanged?.()
        })
    }

    private render(): void {
        const variant = this.getAttribute('variant')
        const classes = ['nav']
        if (variant === 'tabs') classes.push('nav-tabs')
        else if (variant === 'pills') classes.push('nav-pills')
        else if (variant === 'underline') classes.push('nav-underline')
        if (this.hasAttribute('fill')) classes.push('nav-fill')
        if (this.hasAttribute('justified')) classes.push('nav-justified')
        if (this.hasAttribute('vertical')) classes.push('flex-column')

        // THE HOST IS THE NAV LIST — no <ul> to move the consumer's items into.
        setHostClass(this, classes.join(' '))
        this.setAttribute('role', 'list')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Nav
    }
}
