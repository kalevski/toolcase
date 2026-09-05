import { bindOnce, patchHtml } from './internal/patch-html'
import { VARIANTS_CORE } from './internal/variants'
import { setHostClass } from './internal/host-class'
import { deriveInitials } from './internal/initials'
import { esc as escapeAttr } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-avatar'

export type AvatarSize = 'small' | 'default' | 'large'
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away'
export type AvatarVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info'

const SIZES: AvatarSize[] = ['small', 'default', 'large']
const STATUSES: AvatarStatus[] = ['online', 'offline', 'busy', 'away']
const VARIANTS: AvatarVariant[] = [...VARIANTS_CORE]

const userPlaceholderIcon = icon(
    (LucideIcons as Record<string, string>)['User'] ?? '',
    'tc-avatar-placeholder-icon',
)

export class Avatar extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['src', 'alt', 'name', 'size', 'status', 'variant']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get src(): string | null {
        return this.getAttribute('src')
    }
    set src(v: string | null) {
        if (v != null) this.setAttribute('src', v)
        else this.removeAttribute('src')
    }

    get alt(): string | null {
        return this.getAttribute('alt')
    }
    set alt(v: string | null) {
        if (v != null) this.setAttribute('alt', v)
        else this.removeAttribute('alt')
    }

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get size(): AvatarSize {
        const v = this.getAttribute('size') as AvatarSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: AvatarSize) {
        setAttr(this, 'size', v)
    }

    get status(): AvatarStatus | null {
        const v = this.getAttribute('status') as AvatarStatus
        return STATUSES.includes(v) ? v : null
    }
    set status(v: AvatarStatus | null) {
        if (v != null) this.setAttribute('status', v)
        else this.removeAttribute('status')
    }

    get variant(): AvatarVariant {
        const v = this.getAttribute('variant') as AvatarVariant
        return VARIANTS.includes(v) ? v : 'secondary'
    }
    set variant(v: AvatarVariant) {
        setAttr(this, 'variant', v)
    }

    private _contentHtml(): string {
        const src = this.src
        const name = this.name

        if (src) {
            // alt="" marks the image decorative; the host's aria-label carries the accessible name.
            return `<img class="tc-avatar-img" src="${escapeAttr(src)}" alt="">`
        }
        if (name) {
            return `<span class="tc-avatar-initials" aria-hidden="true">${escapeAttr(deriveInitials(name))}</span>`
        }
        return `<span class="tc-avatar-placeholder" aria-hidden="true">${userPlaceholderIcon}</span>`
    }

    private render(): void {
        const size = this.size
        const variant = this.variant
        const status = this.status

        // The host element IS the circle — set its class list and accessible role.
        setHostClass(this, `tc-avatar tc-avatar-${size} tc-avatar-${variant}`)
        this.setAttribute('role', 'img')
        this.setAttribute(
            'aria-label',
            this.getAttribute('alt') ?? this.getAttribute('name') ?? 'Avatar',
        )

        const statusHtml = status
            ? `<span class="tc-avatar-status tc-avatar-status-${status}" role="img" aria-label="${status}"></span>`
            : ''

        patchHtml(this, this._contentHtml() + statusHtml)

        // Wire up image-load-error fallback after the img is in the DOM.
        if (this.src) {
            const img = this.querySelector<HTMLImageElement>('.tc-avatar-img')
            if (img) {
                bindOnce(img, 'error', () => this._handleImageError(), { once: true })
            }
        }
    }

    private _handleImageError(): void {
        const name = this.getAttribute('name')
        // Preserve the status dot across the content swap.
        const statusEl = this.querySelector('.tc-avatar-status')
        const statusHtml = statusEl ? statusEl.outerHTML : ''

        let content: string
        if (name) {
            content = `<span class="tc-avatar-initials" aria-hidden="true">${escapeAttr(deriveInitials(name))}</span>`
        } else {
            content = `<span class="tc-avatar-placeholder" aria-hidden="true">${userPlaceholderIcon}</span>`
        }
        patchHtml(this, content + statusHtml)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Avatar
    }
}
