import { bindOnce, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { closeIcon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-banner'

const DEFAULT_ICONS: Record<string, string> = {
    info: 'info',
    warning: 'triangle-alert',
    success: 'circle-check',
    error: 'circle-x',
}

export type BannerVariant = 'info' | 'warning' | 'success' | 'error' | 'announce'
const VARIANTS: BannerVariant[] = ['info', 'warning', 'success', 'error', 'announce']

interface BannerTagConfig {
    // Attribute the dismiss-persistence key is read from.
    storageAttr: string
    // Attribute the lucide icon name is read from.
    iconAttr: string
    // `auto` → role=alert for error else status; `region` → role=region (announcement).
    role: 'auto' | 'region'
    ariaLabel?: string
    // When true, render a per-variant default icon if none is supplied.
    autoIcon: boolean
}

// Per-tag behaviour. tc-banner is the canonical status banner (per-variant default
// icon, alert/status role, `storage-key` / `icon`). tc-announcement-bar is the
// persistent announcement preset: region role, no auto icon, and the legacy
// `persist-dismiss-key` / `icon-name` attribute names.
const TAG_CONFIG: Record<string, BannerTagConfig> = {
    'tc-banner': {
        storageAttr: 'storage-key',
        iconAttr: 'icon',
        role: 'auto',
        autoIcon: true,
    },
    'tc-announcement-bar': {
        storageAttr: 'persist-dismiss-key',
        iconAttr: 'icon-name',
        role: 'region',
        ariaLabel: 'Announcement',
        autoIcon: false,
    },
}
const DEFAULT_CONFIG = TAG_CONFIG['tc-banner']

/**
 * tc-banner — dismissible status banner with a leading icon, body content, an
 * optional action slot or CTA link, and optional localStorage dismiss
 * persistence. Fires `tc-dismiss` (+ `onDismiss`) when closed.
 *
 * tc-announcement-bar is a preset alias: a region-role announcement bar with no
 * auto icon and the legacy `persist-dismiss-key` / `icon-name` attribute names.
 * Both tags support a named `icon` slot, a named `action` slot, and the
 * `cta-label` / `cta-href` link passthrough.
 */
export class Banner extends HTMLElement {
    private _initialised = false

    onDismiss: (() => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'variant',
            'dismissible',
            'storage-key',
            'persist-dismiss-key',
            'icon',
            'icon-name',
            'cta-label',
            'cta-href',
        ]
    }

    connectedCallback(): void {
        this._initialised = true
        // Apply persisted dismissal before the first paint — `_isStored` was
        // written but never consulted, so a banner with a `storage-key` /
        // `persist-dismiss-key` came back on every reload instead of staying
        // dismissed as documented (and as the demo tells the user it will).
        const key = this._resolvedStorageKey()
        if (key && this._isStored(key)) this.hidden = true
        this.render()
        this._attachCloseHandler()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised || this.hidden) return
        this.render()
        this._attachCloseHandler()
    }

    get variant(): BannerVariant {
        const v = this.getAttribute('variant') as BannerVariant
        return VARIANTS.includes(v) ? v : 'info'
    }
    set variant(v: BannerVariant) {
        setAttr(this, 'variant', v)
    }

    get dismissible(): boolean {
        return this.hasAttribute('dismissible')
    }
    set dismissible(v: boolean) {
        if (v) this.setAttribute('dismissible', '')
        else this.removeAttribute('dismissible')
    }

    get storageKey(): string | null {
        return this.getAttribute(this._config.storageAttr)
    }
    set storageKey(v: string | null) {
        if (v != null) this.setAttribute(this._config.storageAttr, v)
        else this.removeAttribute(this._config.storageAttr)
    }

    get iconName(): string | null {
        return this.getAttribute(this._config.iconAttr)
    }
    set iconName(v: string | null) {
        if (v != null) this.setAttribute(this._config.iconAttr, v)
        else this.removeAttribute(this._config.iconAttr)
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

    private _resolvedStorageKey(): string | null {
        return this.getAttribute(this._config.storageAttr)
    }

    private _isStored(key: string): boolean {
        try {
            return localStorage.getItem(key) === 'dismissed'
        } catch {
            return false
        }
    }

    private _handleDismiss = (): void => {
        const key = this._resolvedStorageKey()
        if (key) {
            try {
                localStorage.setItem(key, 'dismissed')
            } catch {
                /* storage unavailable */
            }
        }
        this.hidden = true
        this.dispatchEvent(new CustomEvent('tc-dismiss', { bubbles: true, composed: true }))
        if (typeof this.onDismiss === 'function') this.onDismiss()
    }

    private _attachCloseHandler(): void {
        const btn = this.querySelector('.tc-banner-close')
        if (btn) {
            bindOnce(btn, 'click', this._handleDismiss, { once: true })
        }
    }

    private get _config(): BannerTagConfig {
        return TAG_CONFIG[this.localName] ?? DEFAULT_CONFIG
    }

    private render(): void {
        const config = this._config
        const variant = this.variant
        const dismissible = this.dismissible
        const iconAttr = this.getAttribute(config.iconAttr)
        const hasIconSlot = this.querySelector(':scope > [slot="icon"]') != null
        const ctaLabel = this.ctaLabel
        const ctaHref = this.ctaHref

        // Apply host classes — preserve any user-added classes.
        this.classList.add('tc-banner')
        VARIANTS.forEach((v) => this.classList.remove(`tc-banner-${v}`))
        this.classList.add(`tc-banner-${variant}`)

        // ARIA: announcement bars are regions; status banners announce via
        // alert (error) or status (everything else).
        if (config.role === 'region') {
            this.setAttribute('role', 'region')
            if (config.ariaLabel) this.setAttribute('aria-label', config.ariaLabel)
        } else {
            this.setAttribute('role', variant === 'error' ? 'alert' : 'status')
        }

        const resolvedIcon = iconAttr ?? (config.autoIcon ? DEFAULT_ICONS[variant] : undefined)
        const showIcon = hasIconSlot || !!resolvedIcon
        const iconSvg = !hasIconSlot && resolvedIcon ? lucideByName(resolvedIcon) : ''
        const iconHtml = showIcon
            ? `<span class="tc-banner-icon" aria-hidden="true">${iconSvg}</span>`
            : ''

        const ctaHtml =
            ctaLabel && ctaHref
                ? `<a class="tc-banner-cta" href="${esc(ctaHref)}">${esc(ctaLabel)}</a>`
                : ''

        const closeHtml = dismissible
            ? `<button type="button" class="tc-banner-close" aria-label="Dismiss">${closeIcon}</button>`
            : ''

        // The icon is prepended and the CTA / close button appended; the message and
        // any `slot="icon"` / `slot="action"` element the consumer wrote stay their
        // children and are placed by CSS `order` (rule 1).
        patchHtml(this, iconHtml, { region: 'icon' })
        patchHtml(this, `${ctaHtml}${closeHtml}`, { region: 'trailing', at: 'end' })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Banner
        'tc-announcement-bar': Banner
    }
}
