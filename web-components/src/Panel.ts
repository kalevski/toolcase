import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const PANEL_TAG = 'tc-panel'
const HEADER_TAG = 'tc-panel-header'

// ── tc-panel ──────────────────────────────────────────────────────────────────

export class Panel extends HTMLElement {
    private _initialised = false
    private _headerNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['bordered']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Separate tc-panel-header children from body children before render
            this._headerNodes = Array.from(this.childNodes).filter(
                (n) => n instanceof Element && n.tagName.toLowerCase() === HEADER_TAG,
            )
            const bodyNodes = Array.from(this.childNodes).filter(
                (n) => !(n instanceof Element && n.tagName.toLowerCase() === HEADER_TAG),
            )

            this.render()

            const headerSlot = this.querySelector('.tc-panel-header-slot')
            if (headerSlot) this._headerNodes.forEach((n) => headerSlot.appendChild(n))
            const body = this.querySelector('.tc-panel-body')
            if (body) bodyNodes.forEach((n) => body.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        const headerSlot = this.querySelector('.tc-panel-header-slot')
        if (headerSlot) {
            const inSlot = Array.from(headerSlot.childNodes).filter(
                (n) => n instanceof Element && n.tagName.toLowerCase() === HEADER_TAG,
            )
            if (inSlot.length > 0) this._headerNodes = inSlot
        }

        const body = this.querySelector('.tc-panel-body')
        const bodyNodes = body ? Array.from(body.childNodes) : []

        this.render()

        const newHeaderSlot = this.querySelector('.tc-panel-header-slot')
        if (newHeaderSlot) this._headerNodes.forEach((n) => newHeaderSlot.appendChild(n))
        const newBody = this.querySelector('.tc-panel-body')
        if (newBody) bodyNodes.forEach((n) => newBody.appendChild(n))
    }

    get bordered(): boolean {
        return this.hasAttribute('bordered')
    }
    set bordered(value: boolean) {
        if (value) this.setAttribute('bordered', '')
        else this.removeAttribute('bordered')
    }

    private render(): void {
        const bordered = this.bordered
        const hasHeader = this._headerNodes.length > 0
        const cls = ['tc-panel', bordered ? 'tc-panel--bordered' : ''].filter(Boolean).join(' ')

        this.innerHTML =
            `<div class="${cls}">` +
            (hasHeader ? `<div class="tc-panel-header-slot"></div>` : '') +
            `<div class="tc-panel-body"></div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [PANEL_TAG]: Panel
    }
}

// ── tc-panel-header ───────────────────────────────────────────────────────────

export class PanelHeader extends HTMLElement {
    private _initialised = false
    private _actionSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['heading', 'icon']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._actionSlotNodes = Array.from(this.querySelectorAll('[slot="action"]'))
            this.render()
            const actionEl = this.querySelector('.tc-panel-header-action')
            if (actionEl) this._actionSlotNodes.forEach((n) => actionEl.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return

        const actionEl = this.querySelector('.tc-panel-header-action')
        if (actionEl) {
            const inAction = Array.from(actionEl.querySelectorAll('[slot="action"]'))
            if (inAction.length > 0) this._actionSlotNodes = inAction
        }

        this.render()

        const newActionEl = this.querySelector('.tc-panel-header-action')
        if (newActionEl) this._actionSlotNodes.forEach((n) => newActionEl.appendChild(n))
    }

    // NOTE: 'heading' is used instead of 'title' to avoid colliding with
    // the native HTMLElement.title reflected attribute (ARIAMixin gotcha).
    get heading(): string {
        return this.getAttribute('heading') ?? ''
    }
    set heading(v: string) {
        if (v) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    private render(): void {
        const heading = this.getAttribute('heading') ?? ''
        const iconName = this.getAttribute('icon')
        const hasAction = this._actionSlotNodes.length > 0

        const svgStr = iconName ? (LucideIcons as Record<string, string>)[iconName] : null
        const iconHtml = svgStr
            ? `<span class="tc-panel-header-icon" aria-hidden="true">${icon(svgStr)}</span>`
            : ''
        const actionHtml = hasAction ? `<div class="tc-panel-header-action"></div>` : ''

        this.innerHTML =
            `<div class="tc-panel-header">` +
            iconHtml +
            `<span class="tc-panel-header-heading">${esc(heading)}</span>` +
            actionHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [HEADER_TAG]: PanelHeader
    }
}
