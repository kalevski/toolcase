const TAG_NAME = 'gc-panel-header'

export type PanelHeaderTitleSize = 'sm' | 'md' | 'lg' | 'xl'

export class PanelHeader extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['eyebrow', 'header-title', 'title-size']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? ''
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get headerTitle(): string {
        return this.getAttribute('header-title') ?? ''
    }
    set headerTitle(v: string) {
        if (v) this.setAttribute('header-title', v)
        else this.removeAttribute('header-title')
    }

    get titleSize(): PanelHeaderTitleSize {
        const raw = this.getAttribute('title-size')
        if (raw === 'sm' || raw === 'lg' || raw === 'xl') return raw
        return 'md'
    }
    set titleSize(v: PanelHeaderTitleSize) {
        this.setAttribute('title-size', v)
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private render(): void {
        this.dataset.size = this.titleSize

        const eyebrowMarkup = this.eyebrow
            ? `<gc-eyebrow class="gc-panel-header-eyebrow">${this.escape(this.eyebrow)}</gc-eyebrow>`
            : ''
        const titleMarkup = this.headerTitle
            ? `<gc-title class="gc-panel-header-title">${this.escape(this.headerTitle)}</gc-title>`
            : ''

        this.innerHTML = `
            ${eyebrowMarkup}
            ${titleMarkup}
            <div class="gc-panel-header-divider">
                <span class="gc-panel-header-rule"></span>
                <span class="gc-panel-header-diamond"></span>
                <span class="gc-panel-header-rule"></span>
            </div>
        `
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PanelHeader)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PanelHeader
    }
}
