import { Menu } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-dashboard-layout'

const menuIcon = icon(Menu)

let _uid = 0

const NAMED_SLOTS: string[] = [
    'navbar-left',
    'navbar-right',
    'brand',
    'sidebar-menu',
    'sidebar-panel',
]

function isNamedSlotNode(n: Node): boolean {
    return n instanceof Element && NAMED_SLOTS.includes(n.getAttribute('slot') ?? '')
}

export class DashboardLayout extends HTMLElement {
    private _initialised = false
    private _sidebarId: string
    private _navbarLeftNodes: Node[] = []
    private _navbarRightNodes: Node[] = []
    private _brandNodes: Node[] = []
    private _sidebarMenuNodes: Node[] = []
    private _sidebarPanelNodes: Node[] = []
    private _contentNodes: Node[] = []
    private _keydownHandler: ((e: KeyboardEvent) => void) | null = null
    // ≥lg the sidebar is a pinned rail (never inert); below it is a drawer.
    private _desktopMq: MediaQueryList | null = null
    private _onMqChange = (): void => this._applyOpenClass()

    onToggleSidebar: ((open: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        return ['sidebar-open']
    }

    constructor() {
        super()
        this._sidebarId = `tc-dl-sidebar-${++_uid}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._navbarLeftNodes = Array.from(this.querySelectorAll('[slot="navbar-left"]'))
            this._navbarRightNodes = Array.from(this.querySelectorAll('[slot="navbar-right"]'))
            this._brandNodes = Array.from(this.querySelectorAll('[slot="brand"]'))
            this._sidebarMenuNodes = Array.from(this.querySelectorAll('[slot="sidebar-menu"]'))
            this._sidebarPanelNodes = Array.from(this.querySelectorAll('[slot="sidebar-panel"]'))
            this._contentNodes = Array.from(this.childNodes).filter((n) => !isNamedSlotNode(n))

            // Closed by default: on mobile this keeps the drawer hidden; on desktop
            // (≥992px) CSS pins the sidebar open regardless of this attribute.
            this.render()
            this._distributeSlots()
            this._applyOpenClass()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._applyOpenClass()
    }

    get sidebarOpen(): boolean {
        return this.hasAttribute('sidebar-open')
    }
    set sidebarOpen(v: boolean) {
        if (v) this.setAttribute('sidebar-open', '')
        else this.removeAttribute('sidebar-open')
    }

    private _handleToggle(): void {
        const newOpen = !this.sidebarOpen
        // Closing while focus sits inside the drawer: hand focus back to the
        // toggle before the drawer goes inert, or the browser drops it on body.
        if (!newOpen) {
            const sidebar = this.querySelector('.tc-dashboard-layout__sidebar')
            if (sidebar && sidebar.contains(document.activeElement)) {
                this.querySelector<HTMLButtonElement>('.tc-dashboard-layout__toggle')?.focus()
            }
        }
        this.sidebarOpen = newOpen
        this.dispatchEvent(
            new CustomEvent('tc-toggle-sidebar', {
                bubbles: true,
                composed: true,
                detail: { open: newOpen },
            }),
        )
        // Discrete open/close events alongside the toggle event, so consumers
        // can bind one direction without reading detail.open.
        this.dispatchEvent(
            new CustomEvent(newOpen ? 'tc-sidebar-open' : 'tc-sidebar-close', {
                bubbles: true,
                composed: true,
            }),
        )
        if (typeof this.onToggleSidebar === 'function') this.onToggleSidebar(newOpen)
    }

    private _isDesktop(): boolean {
        return this._desktopMq?.matches ?? false
    }

    private _applyOpenClass(): void {
        const open = this.sidebarOpen
        const wrapper = this.querySelector('.tc-dashboard-layout__wrapper')
        const toggle = this.querySelector<HTMLButtonElement>('.tc-dashboard-layout__toggle')
        const overlay = this.querySelector('.tc-dashboard-layout__overlay')
        const sidebar = this.querySelector<HTMLElement>('.tc-dashboard-layout__sidebar')
        if (wrapper) {
            wrapper.classList.toggle('tc-dashboard-layout__wrapper--open', open)
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        }
        if (overlay) {
            overlay.setAttribute('aria-hidden', open ? 'false' : 'true')
        }
        if (sidebar) {
            // A closed mobile drawer leaves the tab order and the a11y tree —
            // translateX(-100%) alone keeps its buttons focusable/clickable.
            // On desktop the rail is pinned open, so it is never inert.
            const hidden = !open && !this._isDesktop()
            sidebar.toggleAttribute('inert', hidden)
            if (hidden) sidebar.setAttribute('aria-hidden', 'true')
            else sidebar.removeAttribute('aria-hidden')
        }
    }

    private _distributeSlots(): void {
        const navLeftEl = this.querySelector('.tc-dashboard-layout__navbar-left')
        if (navLeftEl) this._navbarLeftNodes.forEach((n) => navLeftEl.appendChild(n))
        const navRightEl = this.querySelector('.tc-dashboard-layout__navbar-right')
        if (navRightEl) this._navbarRightNodes.forEach((n) => navRightEl.appendChild(n))
        const brandEl = this.querySelector('.tc-dashboard-layout__brand')
        if (brandEl) this._brandNodes.forEach((n) => brandEl.appendChild(n))
        const sidebarMenuEl = this.querySelector('.tc-dashboard-layout__sidebar-menu')
        if (sidebarMenuEl) this._sidebarMenuNodes.forEach((n) => sidebarMenuEl.appendChild(n))
        const sidebarPanelEl = this.querySelector('.tc-dashboard-layout__sidebar-panel')
        if (sidebarPanelEl) this._sidebarPanelNodes.forEach((n) => sidebarPanelEl.appendChild(n))
        const contentEl = this.querySelector('.tc-dashboard-layout__content')
        if (contentEl) this._contentNodes.forEach((n) => contentEl.appendChild(n))
    }

    private _attachHandlers(): void {
        this._keydownHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault()
                this._handleToggle()
            } else if (e.key === 'Escape' && this.sidebarOpen) {
                this._handleToggle()
            } else if (e.key === 'Tab' && this.sidebarOpen && !this._isDesktop()) {
                this._trapFocus(e)
            }
        }
        document.addEventListener('keydown', this._keydownHandler)
        this.addEventListener('click', this._onClick)
        if (typeof window.matchMedia === 'function' && !this._desktopMq) {
            this._desktopMq = window.matchMedia('(min-width: 992px)')
        }
        // Crossing the lg boundary flips the drawer/rail semantics — re-derive inert.
        this._desktopMq?.addEventListener('change', this._onMqChange)
        this._applyOpenClass()
    }

    private _detachHandlers(): void {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler)
            this._keydownHandler = null
        }
        this.removeEventListener('click', this._onClick)
        this._desktopMq?.removeEventListener('change', this._onMqChange)
    }

    // While the mobile drawer is open it is a modal surface: Tab cycles within
    // it instead of escaping into the dimmed content behind the backdrop.
    private _trapFocus(e: KeyboardEvent): void {
        const sidebar = this.querySelector<HTMLElement>('.tc-dashboard-layout__sidebar')
        if (!sidebar) return
        const focusables = Array.from(
            sidebar.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
                    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
        ).filter((el) => el.offsetParent !== null || el === document.activeElement)
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement
        if (!sidebar.contains(active)) {
            e.preventDefault()
            first.focus()
            return
        }
        if (e.shiftKey && active === first) {
            e.preventDefault()
            last.focus()
        } else if (!e.shiftKey && active === last) {
            e.preventDefault()
            first.focus()
        }
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element
        if (target.closest('.tc-dashboard-layout__toggle')) {
            this._handleToggle()
            return
        }
        // Tapping the dimmed backdrop closes the mobile drawer.
        if (target.closest('.tc-dashboard-layout__overlay') && this.sidebarOpen) {
            this._handleToggle()
        }
    }

    private render(): void {
        const sidebarId = this._sidebarId

        this.innerHTML =
            `<div class="tc-dashboard-layout">` +
            `<div class="tc-dashboard-layout__wrapper">` +
            `<nav class="tc-dashboard-layout__navbar" role="navigation" aria-label="Application navigation">` +
            `<button class="tc-dashboard-layout__toggle" type="button" aria-label="Toggle sidebar" aria-expanded="false" aria-controls="${sidebarId}">` +
            menuIcon +
            `</button>` +
            `<div class="tc-dashboard-layout__navbar-left"></div>` +
            `<div class="tc-dashboard-layout__navbar-right"></div>` +
            `</nav>` +
            `<div class="tc-dashboard-layout__overlay" aria-hidden="true"></div>` +
            `<aside class="tc-dashboard-layout__sidebar" id="${sidebarId}" role="navigation" aria-label="Sidebar navigation">` +
            `<div class="tc-dashboard-layout__brand"></div>` +
            `<div class="tc-dashboard-layout__sidebar-menu"></div>` +
            `<div class="tc-dashboard-layout__sidebar-panel"></div>` +
            `</aside>` +
            `<main class="tc-dashboard-layout__content"></main>` +
            `</div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DashboardLayout
    }
}
