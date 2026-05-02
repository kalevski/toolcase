const TAG_NAME = 'gc-platform-icon'

export type Platform = 'pc' | 'playstation' | 'xbox' | 'nintendo' | 'steam' | 'mobile' | 'web'

const PLATFORM_GLYPH: Record<Platform, string> = {
    pc: '🖥',
    playstation: '🎮',
    xbox: '✕',
    nintendo: '◉',
    steam: '⚙',
    mobile: '📱',
    web: '🌐'
}

const PLATFORM_LABEL: Record<Platform, string> = {
    pc: 'PC',
    playstation: 'PlayStation',
    xbox: 'Xbox',
    nintendo: 'Nintendo',
    steam: 'Steam',
    mobile: 'Mobile',
    web: 'Web'
}

export class PlatformIcon extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['platform', 'size', 'label']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        if (!this.hasAttribute('platform')) {
            this.setAttribute('platform', 'pc')
        }
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get platform(): Platform {
        return (this.getAttribute('platform') as Platform) || 'pc'
    }
    set platform(value: Platform) {
        this.setAttribute('platform', value)
    }

    get size(): number | null {
        const value = this.getAttribute('size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set size(value: number | null) {
        if (value == null) this.removeAttribute('size')
        else this.setAttribute('size', String(value))
    }

    get label(): boolean {
        return this.hasAttribute('label')
    }
    set label(value: boolean) {
        if (value) this.setAttribute('label', '')
        else this.removeAttribute('label')
    }

    private render(): void {
        const size = this.size
        if (size != null) {
            this.style.setProperty('--gc-platform-icon-size', `${size}px`)
        } else {
            this.style.removeProperty('--gc-platform-icon-size')
        }

        const platform = this.platform
        const glyph = PLATFORM_GLYPH[platform] || '?'
        const labelHtml = this.label
            ? `<span class="gc-platform-icon-label">${this.escape(PLATFORM_LABEL[platform] || platform)}</span>`
            : ''
        this.innerHTML = `<span class="gc-platform-icon-glyph">${this.escape(glyph)}</span>${labelHtml}`
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PlatformIcon)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PlatformIcon
    }
}
