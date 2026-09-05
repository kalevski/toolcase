import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { Menu } from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-cool-nav'

const menuIcon = icon(Menu)

let _uid = 0

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', 'xxl']

const BP_PX: Record<string, number> = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 }

function bpToPx(bp: string): number {
    return BP_PX[bp] ?? 992
}

export interface CoolNavItem {
    label: string
    href: string
    active?: boolean
}

export type CoolNavTheme = 'light' | 'dark'

const THEMES: CoolNavTheme[] = ['light', 'dark']

export class CoolNav extends HTMLElement {
    private _initialised = false
    private _items: CoolNavItem[] = []
    private _isOpen = false
    private _collapseId: string
    private _brandSlotNodes: Node[] = []
    private _rightSlotNodes: Node[] = []
    private _scrollHandler: (() => void) | null = null
    private _resizeHandler: (() => void) | null = null

    onNavToggle: ((open: boolean) => void) | null = null
    onLogin: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'brand',
            'login-label',
            'login-href',
            'login-variant',
            'scroll-offset',
            'expand-breakpoint',
            'theme',
            'sticky',
        ]
    }

    constructor() {
        super()
        this._collapseId = `tc-cool-nav-collapse-${++_uid}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named slot children before render wipes innerHTML
            this._brandSlotNodes = Array.from(this.querySelectorAll('[slot="brand"]'))
            this._rightSlotNodes = Array.from(this.querySelectorAll('[slot="right"]'))
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._recaptureSlots()
        this.render()
        this._distributeSlots()
    }

    // ── Attributes ──────────────────────────────────────────────────────────

    get brand(): string | null {
        return this.getAttribute('brand')
    }
    set brand(v: string | null) {
        if (v != null) this.setAttribute('brand', v)
        else this.removeAttribute('brand')
    }

    get loginLabel(): string {
        return this.getAttribute('login-label') ?? 'Log in'
    }
    set loginLabel(v: string) {
        setAttr(this, 'login-label', v)
    }

    get loginHref(): string | null {
        return this.getAttribute('login-href')
    }
    set loginHref(v: string | null) {
        if (v != null) this.setAttribute('login-href', v)
        else this.removeAttribute('login-href')
    }

    get loginVariant(): string {
        return this.getAttribute('login-variant') ?? 'primary'
    }
    set loginVariant(v: string) {
        setAttr(this, 'login-variant', v)
    }

    get scrollOffset(): number {
        return parseInt(this.getAttribute('scroll-offset') ?? '10', 10) || 10
    }
    set scrollOffset(v: number) {
        this.setAttribute('scroll-offset', String(v))
    }

    get expandBreakpoint(): string {
        const v = this.getAttribute('expand-breakpoint') ?? 'lg'
        return BREAKPOINTS.includes(v) ? v : 'lg'
    }
    set expandBreakpoint(v: string) {
        setAttr(this, 'expand-breakpoint', v)
    }

    get theme(): CoolNavTheme {
        const v = this.getAttribute('theme') as CoolNavTheme
        return THEMES.includes(v) ? v : 'light'
    }
    set theme(v: CoolNavTheme) {
        setAttr(this, 'theme', v)
    }

    get sticky(): boolean {
        return this.hasAttribute('sticky')
    }
    set sticky(v: boolean) {
        if (v) this.setAttribute('sticky', '')
        else this.removeAttribute('sticky')
    }

    // ── JS Property ─────────────────────────────────────────────────────────

    get items(): CoolNavItem[] {
        return this._items
    }
    set items(v: CoolNavItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._recaptureSlots()
            this.render()
            this._distributeSlots()
        }
    }

    // ── Slot management ─────────────────────────────────────────────────────

    private _distributeSlots(): void {
        if (!this.hasAttribute('brand')) {
            const brandEl = this.querySelector('.tc-cool-nav-brand-slot')
            if (brandEl) this._brandSlotNodes.forEach((n) => brandEl.appendChild(n))
        }
        const rightEl = this.querySelector('.tc-cool-nav-right-slot')
        if (rightEl) this._rightSlotNodes.forEach((n) => rightEl.appendChild(n))
    }

    private _recaptureSlots(): void {
        const brandEl = this.querySelector('.tc-cool-nav-brand-slot')
        if (brandEl) {
            const inBrand = Array.from(brandEl.querySelectorAll('[slot="brand"]'))
            if (inBrand.length > 0) this._brandSlotNodes = inBrand
        }
        const rightEl = this.querySelector('.tc-cool-nav-right-slot')
        if (rightEl) {
            const inRight = Array.from(rightEl.querySelectorAll('[slot="right"]'))
            if (inRight.length > 0) this._rightSlotNodes = inRight
        }
    }

    // ── Scroll & resize handlers ─────────────────────────────────────────────

    private _attachHandlers(): void {
        this._scrollHandler = () => {
            const scrolled = window.scrollY > this.scrollOffset
            this.classList.toggle('tc-cool-nav-scrolled', scrolled)
        }
        this._resizeHandler = () => {
            const bpPx = bpToPx(this.expandBreakpoint)
            if (window.innerWidth >= bpPx && this._isOpen) {
                this._setOpen(false, false)
            }
        }
        window.addEventListener('scroll', this._scrollHandler, { passive: true })
        window.addEventListener('resize', this._resizeHandler, { passive: true })
        this.addEventListener('click', this._onClick)
    }

    private _detachHandlers(): void {
        if (this._scrollHandler) {
            window.removeEventListener('scroll', this._scrollHandler)
            this._scrollHandler = null
        }
        if (this._resizeHandler) {
            window.removeEventListener('resize', this._resizeHandler)
            this._resizeHandler = null
        }
        this.removeEventListener('click', this._onClick)
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element
        // Toggler
        if (target.closest('.tc-cool-nav-toggler')) {
            this._setOpen(!this._isOpen)
            return
        }
        // Nav link — close on small viewports
        if (target.closest('.tc-cool-nav-link')) {
            const bpPx = bpToPx(this.expandBreakpoint)
            if (window.innerWidth < bpPx) {
                this._setOpen(false)
            }
            return
        }
        // Login CTA
        if (target.closest('.tc-cool-nav-login')) {
            this.dispatchEvent(
                new CustomEvent('tc-login', { bubbles: true, composed: true, detail: {} }),
            )
            if (typeof this.onLogin === 'function') this.onLogin()
        }
    }

    private _setOpen(open: boolean, dispatch = true): void {
        this._isOpen = open
        const collapse = this.querySelector<HTMLElement>('.tc-cool-nav-collapse')
        const toggler = this.querySelector<HTMLElement>('.tc-cool-nav-toggler')
        if (collapse) {
            if (open) {
                collapse.classList.add('tc-cool-nav-collapse--open')
            } else {
                collapse.classList.remove('tc-cool-nav-collapse--open')
            }
        }
        if (toggler) {
            toggler.setAttribute('aria-expanded', open ? 'true' : 'false')
        }
        if (dispatch) {
            this.dispatchEvent(
                new CustomEvent('tc-nav-toggle', {
                    bubbles: true,
                    composed: true,
                    detail: { open },
                }),
            )
            if (typeof this.onNavToggle === 'function') this.onNavToggle(open)
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private render(): void {
        const brand = this.getAttribute('brand')
        const loginLabel = this.loginLabel
        const loginHref = this.loginHref
        const loginVariant = this.loginVariant
        const expandBp = this.expandBreakpoint
        const theme = this.theme
        const sticky = this.sticky
        const collapseId = this._collapseId

        // Host classes — manage surgically to preserve user-added classes
        this.classList.add('tc-cool-nav')

        if (sticky) {
            this.classList.add('tc-cool-nav--sticky')
        } else {
            this.classList.remove('tc-cool-nav--sticky')
        }

        THEMES.forEach((t) => this.classList.remove(`tc-cool-nav--${t}`))
        this.classList.add(`tc-cool-nav--${theme}`)

        // Brand area
        let brandHtml: string
        if (brand !== null) {
            brandHtml =
                `<a class="tc-cool-nav-brand" href="#" aria-label="${esc(brand)}">` +
                `<span class="tc-cool-nav-brand-dot" aria-hidden="true"></span>` +
                `<span class="tc-cool-nav-brand-text">${esc(brand)}</span>` +
                `</a>`
        } else {
            brandHtml = `<span class="tc-cool-nav-brand"><span class="tc-cool-nav-brand-slot"></span></span>`
        }

        // Nav items
        const itemsHtml = this._items
            .map((item) => {
                const activeAttr = item.active ? ' aria-current="page"' : ''
                const activeCls = item.active ? ' tc-cool-nav-link--active' : ''
                return (
                    `<li class="tc-cool-nav-item">` +
                    `<a class="tc-cool-nav-link${activeCls}" href="${esc(item.href)}"${activeAttr}>${esc(item.label)}</a>` +
                    `</li>`
                )
            })
            .join('')

        // Login CTA
        let loginHtml = ''
        if (loginHref) {
            loginHtml = `<a class="btn btn-${esc(loginVariant)} tc-cool-nav-login" href="${esc(loginHref)}">${esc(loginLabel)}</a>`
        } else if (loginLabel) {
            loginHtml = `<button class="btn btn-${esc(loginVariant)} tc-cool-nav-login" type="button">${esc(loginLabel)}</button>`
        }

        // Right slot
        const rightHtml = `<span class="tc-cool-nav-right-slot"></span>`

        // Toggler — carries the expand-bp class so SCSS can hide it above the bp
        const togglerHtml =
            `<button class="tc-cool-nav-toggler tc-cool-nav-toggler--${esc(expandBp)}" ` +
            `type="button" aria-label="Toggle navigation" ` +
            `aria-controls="${collapseId}" aria-expanded="${this._isOpen ? 'true' : 'false'}">` +
            menuIcon +
            `</button>`

        // Collapse — carries the expand-bp class so SCSS can show it above the bp
        const collapseCls = [
            'tc-cool-nav-collapse',
            `tc-cool-nav-collapse--expand-${expandBp}`,
            ...(this._isOpen ? ['tc-cool-nav-collapse--open'] : []),
        ].join(' ')

        const collapseHtml =
            `<div class="${collapseCls}" id="${collapseId}">` +
            `<ul class="tc-cool-nav-items">${itemsHtml}</ul>` +
            `<div class="tc-cool-nav-end">${rightHtml}${loginHtml}</div>` +
            `</div>`

        patchHtml(
            this,
            `<nav class="tc-cool-nav-inner" aria-label="Main navigation">` +
                `<div class="tc-cool-nav-container">` +
                brandHtml +
                togglerHtml +
                collapseHtml +
                `</div>` +
                `</nav>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CoolNav
    }
}
