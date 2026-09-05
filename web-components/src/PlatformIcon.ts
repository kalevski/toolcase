import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-platform-icon'

export type Platform = 'pc' | 'playstation' | 'xbox' | 'nintendo' | 'steam' | 'mobile' | 'web'

const PLATFORMS: Platform[] = ['pc', 'playstation', 'xbox', 'nintendo', 'steam', 'mobile', 'web']

const PLATFORM_ICON: Record<Platform, string> = {
    pc: 'monitor',
    playstation: 'gamepad-2',
    xbox: 'gamepad',
    nintendo: 'disc',
    steam: 'cog',
    mobile: 'smartphone',
    web: 'globe',
}

const PLATFORM_LABEL: Record<Platform, string> = {
    pc: 'PC',
    playstation: 'PlayStation',
    xbox: 'Xbox',
    nintendo: 'Nintendo',
    steam: 'Steam',
    mobile: 'Mobile',
    web: 'Web',
}

export class PlatformIcon extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['platform', 'size', 'label']
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

    get platform(): Platform {
        const v = this.getAttribute('platform') as Platform
        return PLATFORMS.includes(v) ? v : 'pc'
    }
    set platform(v: Platform) {
        setAttr(this, 'platform', v)
    }

    get size(): number | null {
        const raw = this.getAttribute('size')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
    }
    set size(v: number | null) {
        if (v == null) this.removeAttribute('size')
        else this.setAttribute('size', String(v))
    }

    get label(): boolean {
        return this.hasAttribute('label')
    }
    set label(v: boolean) {
        if (v) this.setAttribute('label', '')
        else this.removeAttribute('label')
    }

    private render(): void {
        const size = this.size
        if (size != null) {
            this.style.setProperty('--bs-platform-icon-size', `${size}px`)
        } else {
            this.style.removeProperty('--bs-platform-icon-size')
        }

        const platform = this.platform
        const iconName = PLATFORM_ICON[platform]
        const iconHtml = lucideByName(iconName)
        const labelText = PLATFORM_LABEL[platform]

        this.setAttribute('role', 'img')
        this.setAttribute('aria-label', labelText)

        const labelHtml = this.label
            ? `<span class="tc-platform-icon__label">${esc(labelText)}</span>`
            : ''

        patchHtml(
            this,
            `<span class="tc-platform-icon__glyph" aria-hidden="true">${iconHtml}</span>` +
                labelHtml,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlatformIcon
    }
}
