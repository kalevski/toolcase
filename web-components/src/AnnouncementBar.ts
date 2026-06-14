import * as LucideIcons from 'lucide-static'
import { icon, closeIcon } from './icons'

const TAG_NAME = 'tc-announcement-bar'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

export type AnnouncementBarVariant = 'info' | 'success' | 'warning' | 'announce'
const VARIANTS: AnnouncementBarVariant[] = ['info', 'success', 'warning', 'announce']

export class AnnouncementBar extends HTMLElement {
    private _initialised = false
    private _iconSlotNodes: Node[] = []
    private _messageNodes: Node[] = []

    onDismiss: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['variant', 'cta-label', 'cta-href', 'dismissible', 'persist-dismiss-key', 'icon-name']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const key = this.persistDismissKey
            if (key && this._isStored(key)) {
                this.hidden = true
                this._initialised = true
                return
            }

            // Named icon slot + default slot: filter named nodes out of childNodes
            this._iconSlotNodes = Array.from(this.querySelectorAll('[slot="icon"]'))
            this._messageNodes = Array.from(this.childNodes).filter(
                n => !(n instanceof Element && n.getAttribute('slot') === 'icon')
            )

            this.render()
            this._redistributeSlots()
            this._attachCloseHandler()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised || this.hidden) return
        // Re-capture from within their containers (nodes have already been moved)
        this._iconSlotNodes = Array.from(
            this.querySelectorAll('.tc-announcement-bar-icon [slot="icon"]')
        )
        const msgContainer = this.querySelector('.tc-announcement-bar-message')
        this._messageNodes = msgContainer ? Array.from(msgContainer.childNodes) : []
        this.render()
        this._redistributeSlots()
        this._attachCloseHandler()
    }

    get variant(): AnnouncementBarVariant {
        const v = this.getAttribute('variant') as AnnouncementBarVariant
        return VARIANTS.includes(v) ? v : 'info'
    }
    set variant(v: AnnouncementBarVariant) {
        this.setAttribute('variant', v)
    }

    get ctaLabel(): string | null {
        return this.getAttribute('cta-label')
    }
    set ctaLabel(v: string | null) {
        if (v != null) this.setAttribute('cta-label', v)
        else this.removeAttribute('cta-label')
    }

    get ctaHref(): string | null {
        return this.getAttribute('cta-href')
    }
    set ctaHref(v: string | null) {
        if (v != null) this.setAttribute('cta-href', v)
        else this.removeAttribute('cta-href')
    }

    get dismissible(): boolean {
        return this.hasAttribute('dismissible')
    }
    set dismissible(v: boolean) {
        if (v) this.setAttribute('dismissible', '')
        else this.removeAttribute('dismissible')
    }

    get persistDismissKey(): string | null {
        return this.getAttribute('persist-dismiss-key')
    }
    set persistDismissKey(v: string | null) {
        if (v != null) this.setAttribute('persist-dismiss-key', v)
        else this.removeAttribute('persist-dismiss-key')
    }

    get iconName(): string | null {
        return this.getAttribute('icon-name')
    }
    set iconName(v: string | null) {
        if (v != null) this.setAttribute('icon-name', v)
        else this.removeAttribute('icon-name')
    }

    private _isStored(key: string): boolean {
        try {
            return localStorage.getItem(key) === 'dismissed'
        } catch {
            return false
        }
    }

    private _handleDismiss = (): void => {
        const key = this.persistDismissKey
        if (key) {
            try { localStorage.setItem(key, 'dismissed') } catch {}
        }
        this.hidden = true
        this.dispatchEvent(new CustomEvent('tc-dismiss', { bubbles: true, composed: true }))
        if (typeof this.onDismiss === 'function') this.onDismiss()
    }

    private _attachCloseHandler(): void {
        const btn = this.querySelector('.tc-announcement-bar-close')
        if (btn) {
            btn.addEventListener('click', this._handleDismiss, { once: true })
        }
    }

    private _redistributeSlots(): void {
        const iconContainer = this.querySelector('.tc-announcement-bar-icon')
        if (iconContainer && this._iconSlotNodes.length > 0) {
            // Slot children take priority over the iconName lucide fallback
            iconContainer.innerHTML = ''
            this._iconSlotNodes.forEach(n => iconContainer.appendChild(n))
        }
        const msgContainer = this.querySelector('.tc-announcement-bar-message')
        if (msgContainer) {
            this._messageNodes.forEach(n => msgContainer.appendChild(n))
        }
    }

    private render(): void {
        const variant = this.variant
        const ctaLabel = this.ctaLabel
        const ctaHref = this.ctaHref
        const dismissible = this.dismissible
        const iconName = this.iconName

        // Host carries the layout classes
        this.classList.add('tc-announcement-bar')
        VARIANTS.forEach(v => this.classList.remove(`tc-announcement-bar-${v}`))
        this.classList.add(`tc-announcement-bar-${variant}`)
        this.setAttribute('role', 'region')
        this.setAttribute('aria-label', 'Announcement')

        const hasIconSlot = this._iconSlotNodes.length > 0
        const showIcon = hasIconSlot || !!iconName
        // If slot nodes exist they'll override this content in _redistributeSlots
        const iconSvg = !hasIconSlot && iconName ? lucideByName(iconName) : ''
        const iconHtml = showIcon
            ? `<span class="tc-announcement-bar-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        const ctaHtml = ctaLabel && ctaHref
            ? `<a class="tc-announcement-bar-cta" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>`
            : ''

        const closeHtml = dismissible
            ? `<button type="button" class="tc-announcement-bar-close" aria-label="Dismiss">${closeIcon}</button>`
            : ''

        this.innerHTML = `${iconHtml}<span class="tc-announcement-bar-message"></span>${ctaHtml}${closeHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AnnouncementBar
    }
}
