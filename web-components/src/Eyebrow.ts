const TAG_NAME = 'tc-eyebrow'

// Port of game-components `gc-eyebrow` — a small uppercase micro-label shown
// above a heading. The source is a pure default-slot component (no attributes,
// properties, or events), so this port keeps the same minimal surface and only
// swaps the fantasy chrome for the web-components design-system micro-label
// (JetBrains Mono, uppercase, slate-muted), styled via `_eyebrow.scss`.
export class Eyebrow extends HTMLElement {
    private _initialised = false

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-eyebrow-content')
            if (inner) slotContent.forEach((n) => inner.appendChild(n))
            this._initialised = true
        }
    }

    private render(): void {
        this.innerHTML = `<span class="tc-eyebrow"><span class="tc-eyebrow-content"></span></span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Eyebrow
    }
}
