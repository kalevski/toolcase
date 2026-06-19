import { esc } from './internal/esc'
const TAG_NAME = 'tc-title-screen'

// Port of game-components `gc-title-screen`. Game chrome (diamond dividers,
// gilded frames, glows, fantasy fills) is dropped; this renders to the
// web-components design system — a fixed full-viewport surface with a centred
// content panel, mono eyebrow, optional title heading, hairline divider, and
// optional subtitle. All cosmetics flow through `--bs-title-screen-*` custom
// properties so themes can re-skin via vars alone.

export class TitleScreen extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['title-text', 'subtitle', 'eyebrow']
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'region')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    // NOTE: HTMLElement.title is a native reflected attribute — getter/setter
    // deliberately omitted to avoid colliding with the platform property.
    // Use `getAttribute('title-text')` or the `titleText` JS property instead.

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

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? 'Press Start'
    }
    set eyebrow(v: string) {
        this.setAttribute('eyebrow', v)
    }

    private render(): void {
        const titleText = this.titleText
        const subtitle = this.subtitle
        const eyebrow = this.eyebrow

        const titleMarkup = titleText
            ? `<h1 class="tc-title-screen__title">${esc(titleText)}</h1>`
            : ''

        const subtitleMarkup = subtitle
            ? `<p class="tc-title-screen__subtitle">${esc(subtitle)}</p>`
            : ''

        this.innerHTML =
            `<div class="tc-title-screen__panel">` +
            `<div class="tc-title-screen__eyebrow">${esc(eyebrow)}</div>` +
            titleMarkup +
            `<div class="tc-title-screen__divider" aria-hidden="true"></div>` +
            subtitleMarkup +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TitleScreen
    }
}
