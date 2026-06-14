import * as LucideIcons from 'lucide-static'
import { icon, closeIcon } from './icons'

const TAG_NAME = 'tc-banner'

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

const DEFAULT_ICONS: Record<string, string> = {
    info: 'info',
    warning: 'triangle-alert',
    success: 'circle-check',
    error: 'circle-x',
}

export type BannerVariant = 'info' | 'warning' | 'success' | 'error'
const VARIANTS: BannerVariant[] = ['info', 'warning', 'success', 'error']

export class Banner extends HTMLElement {
    private _initialised = false
    private _contentNodes: Node[] = []
    private _actionNodes: Node[] = []

    onDismiss: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['variant', 'dismissible', 'storage-key', 'icon']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const key = this.storageKey
            if (key && this._isStored(key)) {
                this.hidden = true
                this._initialised = true
                return
            }

            // Capture named action slot nodes, filter out of default content
            this._actionNodes = Array.from(this.querySelectorAll('[slot="action"]'))
            this._contentNodes = Array.from(this.childNodes).filter(
                n => !(n instanceof Element && n.getAttribute('slot') === 'action')
            )

            this.render()
            this._redistributeSlots()
            this._attachCloseHandler()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised || this.hidden) return
        // Re-capture from their containers (nodes have already moved)
        this._actionNodes = Array.from(
            this.querySelectorAll('.tc-banner-action [slot="action"]')
        )
        const contentEl = this.querySelector('.tc-banner-content')
        this._contentNodes = contentEl ? Array.from(contentEl.childNodes) : []
        this.render()
        this._redistributeSlots()
        this._attachCloseHandler()
    }

    get variant(): BannerVariant {
        const v = this.getAttribute('variant') as BannerVariant
        return VARIANTS.includes(v) ? v : 'info'
    }
    set variant(v: BannerVariant) {
        this.setAttribute('variant', v)
    }

    get dismissible(): boolean {
        return this.hasAttribute('dismissible')
    }
    set dismissible(v: boolean) {
        if (v) this.setAttribute('dismissible', '')
        else this.removeAttribute('dismissible')
    }

    get storageKey(): string | null {
        return this.getAttribute('storage-key')
    }
    set storageKey(v: string | null) {
        if (v != null) this.setAttribute('storage-key', v)
        else this.removeAttribute('storage-key')
    }

    get iconName(): string | null {
        return this.getAttribute('icon')
    }
    set iconName(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    private _isStored(key: string): boolean {
        try {
            return localStorage.getItem(key) === 'dismissed'
        } catch {
            return false
        }
    }

    private _handleDismiss = (): void => {
        const key = this.storageKey
        if (key) {
            try { localStorage.setItem(key, 'dismissed') } catch {}
        }
        this.hidden = true
        this.dispatchEvent(new CustomEvent('tc-dismiss', { bubbles: true, composed: true }))
        if (typeof this.onDismiss === 'function') this.onDismiss()
    }

    private _attachCloseHandler(): void {
        const btn = this.querySelector('.tc-banner-close')
        if (btn) {
            btn.addEventListener('click', this._handleDismiss, { once: true })
        }
    }

    private _redistributeSlots(): void {
        const contentEl = this.querySelector('.tc-banner-content')
        if (contentEl) {
            this._contentNodes.forEach(n => contentEl.appendChild(n))
        }
        const actionEl = this.querySelector('.tc-banner-action')
        if (actionEl) {
            this._actionNodes.forEach(n => actionEl.appendChild(n))
        }
    }

    private render(): void {
        const variant = this.variant
        const dismissible = this.dismissible
        const iconAttr = this.iconName
        const hasAction = this._actionNodes.length > 0

        // Apply host classes — preserve any user-added classes
        this.classList.add('tc-banner')
        VARIANTS.forEach(v => this.classList.remove(`tc-banner-${v}`))
        this.classList.add(`tc-banner-${variant}`)

        // ARIA: error variant uses alert role for immediate announcement
        this.setAttribute('role', variant === 'error' ? 'alert' : 'status')

        const resolvedIcon = iconAttr ?? DEFAULT_ICONS[variant]
        const iconSvg = lucideByName(resolvedIcon)
        const iconHtml = iconSvg
            ? `<span class="tc-banner-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        const actionHtml = hasAction
            ? `<span class="tc-banner-action"></span>`
            : ''

        const closeHtml = dismissible
            ? `<button type="button" class="tc-banner-close" aria-label="Dismiss">${closeIcon}</button>`
            : ''

        this.innerHTML = `${iconHtml}<span class="tc-banner-content"></span>${actionHtml}${closeHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Banner
    }
}
