import { bindOnce, patchHtml } from './internal/patch-html'
import { adoptChildren } from './internal/adopt-children'
import { Menu } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-dashboard-layout'

const menuIcon = icon(Menu)

let _uid = 0

// `slot="…"` on a child names the region it belongs in; everything else is page
// content. The class suffix is the slot name, so one lookup covers all of them.
const NAMED_SLOTS: string[] = [
    'navbar-left',
    'navbar-right',
    'brand',
    'sidebar-menu',
    'sidebar-panel',
]

function slotOf(node: Node): string {
    const named = node instanceof Element ? (node.getAttribute('slot') ?? '') : ''
    return NAMED_SLOTS.includes(named) ? named : 'content'
}

export class DashboardLayout extends HTMLElement {
    private _initialised = false
    private _sidebarId: string
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
            const slotContent = Array.from(this.childNodes)

            // Closed by default: on mobile this keeps the drawer hidden; on desktop
            // (≥992px) CSS pins the sidebar open regardless of this attribute.
            this.render()
            this._distributeSlots(slotContent)
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

    /**
     * Six regions, one route: the consumer's children go where their `slot` says
     * and the host keeps answering for them — see adopt-children.ts. Routing by
     * lookup rather than by six snapshots is also what makes a child React adds
     * LATER land in the right region instead of nowhere.
     */
    private _distributeSlots(nodes?: Node[]): void {
        adoptChildren(
            this,
            (node) => this.querySelector(`.tc-dashboard-layout__${slotOf(node)}`),
            nodes,
        )
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
        bindOnce(this._desktopMq, 'change', this._onMqChange)
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

        patchHtml(
            this,
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
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DashboardLayout
    }
}
