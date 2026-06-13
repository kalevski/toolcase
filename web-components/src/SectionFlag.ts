const TAG_NAME = 'tc-section-flag'

export type SectionFlagAlign = 'left' | 'center'
const ALIGNS: SectionFlagAlign[] = ['left', 'center']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export class SectionFlag extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['title', 'subtitle', 'align']
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

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        this.setAttribute('title', v)
    }

    get subtitle(): string | null {
        return this.getAttribute('subtitle')
    }
    set subtitle(v: string | null) {
        if (v != null) this.setAttribute('subtitle', v)
        else this.removeAttribute('subtitle')
    }

    get align(): SectionFlagAlign {
        const v = this.getAttribute('align') as SectionFlagAlign
        return ALIGNS.includes(v) ? v : 'left'
    }
    set align(v: SectionFlagAlign) {
        this.setAttribute('align', v)
    }

    private render(): void {
        const align = this.align
        const title = this.title
        const subtitle = this.subtitle

        const subtitleHtml = subtitle != null && subtitle !== ''
            ? `<div class="tc-section-flag-subtitle">${esc(subtitle)}</div>`
            : ''

        this.innerHTML = `
            <div class="tc-section-flag tc-section-flag--${esc(align)}">
                <span class="tc-section-flag-marker" aria-hidden="true"></span>
                <div class="tc-section-flag-text">
                    <h2 class="tc-section-flag-title">${esc(title)}</h2>
                    ${subtitleHtml}
                </div>
            </div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SectionFlag
    }
}
