import { Menu } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-dashboard-layout'

const menuIcon = icon(Menu)

let _uid = 0

const NAMED_SLOTS: string[] = ['navbar-left', 'navbar-right', 'brand', 'sidebar-menu', 'sidebar-panel']

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
            this._contentNodes = Array.from(this.childNodes).filter(n => !isNamedSlotNode(n))

            // Default to open on first connect if attribute not already set
            if (!this.hasAttribute('sidebar-open')) {
                this.setAttribute('sidebar-open', '')
            }

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
        this.sidebarOpen = newOpen
        this.dispatchEvent(new CustomEvent('tc-toggle-sidebar', {
            bubbles: true,
            composed: true,
            detail: { open: newOpen },
        }))
        if (typeof this.onToggleSidebar === 'function') this.onToggleSidebar(newOpen)
    }

    private _applyOpenClass(): void {
        const open = this.sidebarOpen
        const sidebar = this.querySelector('.tc-dashboard-layout__sidebar')
        const toggle = this.querySelector<HTMLButtonElement>('.tc-dashboard-layout__toggle')
        if (sidebar) {
            sidebar.classList.toggle('tc-dashboard-layout__sidebar--collapsed', !open)
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
        }
    }

    private _distributeSlots(): void {
        const navLeftEl = this.querySelector('.tc-dashboard-layout__navbar-left')
        if (navLeftEl) this._navbarLeftNodes.forEach(n => navLeftEl.appendChild(n))
        const navRightEl = this.querySelector('.tc-dashboard-layout__navbar-right')
        if (navRightEl) this._navbarRightNodes.forEach(n => navRightEl.appendChild(n))
        const brandEl = this.querySelector('.tc-dashboard-layout__brand')
        if (brandEl) this._brandNodes.forEach(n => brandEl.appendChild(n))
        const sidebarMenuEl = this.querySelector('.tc-dashboard-layout__sidebar-menu')
        if (sidebarMenuEl) this._sidebarMenuNodes.forEach(n => sidebarMenuEl.appendChild(n))
        const sidebarPanelEl = this.querySelector('.tc-dashboard-layout__sidebar-panel')
        if (sidebarPanelEl) this._sidebarPanelNodes.forEach(n => sidebarPanelEl.appendChild(n))
        const contentEl = this.querySelector('.tc-dashboard-layout__content')
        if (contentEl) this._contentNodes.forEach(n => contentEl.appendChild(n))
    }

    private _attachHandlers(): void {
        this._keydownHandler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault()
                this._handleToggle()
            }
        }
        document.addEventListener('keydown', this._keydownHandler)
        this.addEventListener('click', this._onClick)
    }

    private _detachHandlers(): void {
        if (this._keydownHandler) {
            document.removeEventListener('keydown', this._keydownHandler)
            this._keydownHandler = null
        }
        this.removeEventListener('click', this._onClick)
    }

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element
        if (target.closest('.tc-dashboard-layout__toggle')) {
            this._handleToggle()
        }
    }

    private render(): void {
        const sidebarId = this._sidebarId

        this.innerHTML =
            `<div class="tc-dashboard-layout">` +
            `<nav class="tc-dashboard-layout__navbar" role="navigation" aria-label="Application navigation">` +
            `<button class="tc-dashboard-layout__toggle" type="button" aria-label="Toggle sidebar" aria-expanded="true" aria-controls="${sidebarId}">` +
            menuIcon +
            `</button>` +
            `<div class="tc-dashboard-layout__navbar-left"></div>` +
            `<div class="tc-dashboard-layout__navbar-right"></div>` +
            `</nav>` +
            `<div class="tc-dashboard-layout__body">` +
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
