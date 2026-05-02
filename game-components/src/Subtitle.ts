const TAG_NAME = 'gc-subtitle'

export type SubtitleAlign = 'left' | 'right' | 'center'

export class Subtitle extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['text', 'speaker', 'boxed', 'align', 'font-size', 'max-width']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get text(): string {
        return this.getAttribute('text') || ''
    }
    set text(value: string) {
        if (value) this.setAttribute('text', value)
        else this.removeAttribute('text')
    }

    get speaker(): string {
        return this.getAttribute('speaker') || ''
    }
    set speaker(value: string) {
        if (value) this.setAttribute('speaker', value)
        else this.removeAttribute('speaker')
    }

    get boxed(): boolean {
        return this.hasAttribute('boxed')
    }
    set boxed(value: boolean) {
        if (value) this.setAttribute('boxed', '')
        else this.removeAttribute('boxed')
    }

    get align(): SubtitleAlign {
        return (this.getAttribute('align') as SubtitleAlign) || 'center'
    }
    set align(value: SubtitleAlign) {
        this.setAttribute('align', value)
    }

    get fontSize(): number | null {
        const value = this.getAttribute('font-size')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set fontSize(value: number | null) {
        if (value == null) this.removeAttribute('font-size')
        else this.setAttribute('font-size', String(value))
    }

    get maxWidth(): number | null {
        const value = this.getAttribute('max-width')
        if (value == null) return null
        const parsed = parseFloat(value)
        return Number.isNaN(parsed) ? null : parsed
    }
    set maxWidth(value: number | null) {
        if (value == null) this.removeAttribute('max-width')
        else this.setAttribute('max-width', String(value))
    }

    private render(): void {
        const fs = this.fontSize
        if (fs != null) {
            this.style.setProperty('--gc-subtitle-font-size', `${fs}px`)
        } else {
            this.style.removeProperty('--gc-subtitle-font-size')
        }

        const mw = this.maxWidth
        if (mw != null) {
            this.style.setProperty('--gc-subtitle-max-width', `${mw}px`)
        } else {
            this.style.removeProperty('--gc-subtitle-max-width')
        }

        const text = this.text
        const speaker = this.speaker
        const speakerHtml = speaker
            ? `<div class="gc-subtitle-speaker">${this.escape(speaker)}</div>`
            : ''
        const textHtml = `<div class="gc-subtitle-text">${this.escape(text)}</div>`
        this.innerHTML = `${speakerHtml}${textHtml}`
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

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Subtitle
    }
}
