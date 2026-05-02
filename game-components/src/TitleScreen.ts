const TAG_NAME = 'gc-title-screen'

export class TitleScreen extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['title-text', 'subtitle']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get titleText(): string {
        return this.getAttribute('title-text') ?? ''
    }
    set titleText(v: string) {
        if (v) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get subtitle(): string {
        return this.getAttribute('subtitle') ?? ''
    }
    set subtitle(v: string) {
        if (v) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
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
        const title = this.titleText
        const subtitle = this.subtitle

        const titleMarkup = title
            ? `<gc-title class="gc-title-screen-title">${this.escape(title)}</gc-title>`
            : ''
        const subtitleMarkup = subtitle
            ? `<div class="gc-title-screen-subtitle">${this.escape(subtitle)}</div>`
            : ''

        this.innerHTML = `
            <div class="gc-title-screen-root">
                <gc-eyebrow class="gc-title-screen-eyebrow">Press Start</gc-eyebrow>
                ${titleMarkup}
                <div class="gc-title-screen-divider"><span class="gc-title-screen-rule"></span><span class="gc-title-screen-diamond"></span><span class="gc-title-screen-rule"></span></div>
                ${subtitleMarkup}
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TitleScreen
    }
}
