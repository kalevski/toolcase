const TAG_NAME = 'gc-controller-layout-preview'

export type ControllerLayout = 'xbox' | 'playstation' | 'nintendo' | 'generic'

export class ControllerLayoutPreview extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['layout']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'img')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get layout(): ControllerLayout {
        const raw = this.getAttribute('layout') ?? ''
        if (raw === 'xbox' || raw === 'playstation' || raw === 'nintendo') return raw
        return 'generic'
    }
    set layout(v: ControllerLayout) {
        this.setAttribute('layout', v)
    }

    private buttonGlyph(layout: ControllerLayout, position: 'top' | 'right' | 'bottom' | 'left'): string {
        if (layout === 'playstation') {
            switch (position) {
                case 'top': return '△'
                case 'right': return '◯'
                case 'bottom': return '✕'
                case 'left': return '☐'
            }
        }
        if (layout === 'nintendo') {
            switch (position) {
                case 'top': return 'X'
                case 'right': return 'A'
                case 'bottom': return 'B'
                case 'left': return 'Y'
            }
        }
        if (layout === 'xbox') {
            switch (position) {
                case 'top': return 'Y'
                case 'right': return 'B'
                case 'bottom': return 'A'
                case 'left': return 'X'
            }
        }
        switch (position) {
            case 'top': return '△'
            case 'right': return '▷'
            case 'bottom': return '▽'
            case 'left': return '◁'
        }
    }

    private buttonColor(layout: ControllerLayout, position: 'top' | 'right' | 'bottom' | 'left'): string {
        if (layout === 'playstation') {
            switch (position) {
                case 'top': return 'var(--fg-stamina-bright)'
                case 'right': return 'var(--fg-blood-bright)'
                case 'bottom': return 'var(--fg-mana-bright)'
                case 'left': return 'var(--fg-arcane-bright)'
            }
        }
        if (layout === 'xbox') {
            switch (position) {
                case 'top': return 'var(--fg-gold-bright)'
                case 'right': return 'var(--fg-blood-bright)'
                case 'bottom': return 'var(--fg-stamina-bright)'
                case 'left': return 'var(--fg-mana-bright)'
            }
        }
        return 'var(--fg-gold-bright)'
    }

    private render(): void {
        const layout = this.layout
        const labelMap: Record<ControllerLayout, string> = {
            xbox: 'Xbox',
            playstation: 'PlayStation',
            nintendo: 'Nintendo',
            generic: 'Generic'
        }

        const button = (pos: 'top' | 'right' | 'bottom' | 'left') => {
            const color = this.buttonColor(layout, pos)
            const glyph = this.buttonGlyph(layout, pos)
            return `<div class="gc-controller-layout-preview-btn gc-controller-layout-preview-btn-${pos}" style="--gc-controller-layout-preview-btn-color:${color};">${glyph}</div>`
        }

        this.innerHTML = `
            <svg class="gc-controller-layout-preview-body" viewBox="0 0 240 140" aria-hidden="true">
                <path d="M40 30 Q60 18 100 22 L140 22 Q180 18 200 30 Q220 56 218 86 Q210 122 180 124 Q160 118 140 100 L100 100 Q80 118 60 124 Q30 122 22 86 Q20 56 40 30 Z" fill="#2a1f14" stroke="var(--fg-gold-deep)" stroke-width="1" />
                <circle cx="78" cy="62" r="14" fill="#0e0905" stroke="var(--fg-gold-deep)" stroke-width="1" />
                <circle cx="78" cy="62" r="6" fill="var(--fg-gold-deep)" />
                <circle cx="148" cy="86" r="14" fill="#0e0905" stroke="var(--fg-gold-deep)" stroke-width="1" />
                <circle cx="148" cy="86" r="6" fill="var(--fg-gold-deep)" />
                <rect x="100" y="50" width="20" height="20" rx="2" fill="#0e0905" stroke="var(--fg-gold-deep)" stroke-width="1" />
            </svg>
            <div class="gc-controller-layout-preview-buttons">
                ${button('top')}
                ${button('right')}
                ${button('bottom')}
                ${button('left')}
            </div>
            <div class="gc-controller-layout-preview-label">${labelMap[layout]}</div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ControllerLayoutPreview)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ControllerLayoutPreview
    }
}
