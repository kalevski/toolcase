import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-subtitle'

export type SubtitleAlign = 'left' | 'right' | 'center'
const ALIGNS: SubtitleAlign[] = ['left', 'right', 'center']

export class Subtitle extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['text', 'speaker', 'boxed', 'align', 'font-size', 'max-width']
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

    get text(): string {
        return this.getAttribute('text') ?? ''
    }
    set text(value: string) {
        if (value) this.setAttribute('text', value)
        else this.removeAttribute('text')
    }

    get speaker(): string {
        return this.getAttribute('speaker') ?? ''
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
        const raw = this.getAttribute('align') as SubtitleAlign
        return ALIGNS.includes(raw) ? raw : 'center'
    }
    set align(value: SubtitleAlign) {
        setAttr(this, 'align', value)
    }

    get fontSize(): number | null {
        const raw = this.getAttribute('font-size')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
    }
    set fontSize(value: number | null) {
        if (value == null) this.removeAttribute('font-size')
        else this.setAttribute('font-size', String(value))
    }

    get maxWidth(): number | null {
        const raw = this.getAttribute('max-width')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isNaN(parsed) || parsed <= 0 ? null : parsed
    }
    set maxWidth(value: number | null) {
        if (value == null) this.removeAttribute('max-width')
        else this.setAttribute('max-width', String(value))
    }

    private render(): void {
        this.classList.add('tc-subtitle')
        if (this.boxed) {
            this.classList.add('tc-subtitle--boxed')
        } else {
            this.classList.remove('tc-subtitle--boxed')
        }
        this.dataset.align = this.align

        const fs = this.fontSize
        if (fs != null) this.style.setProperty('--bs-subtitle-font-size', `${fs}px`)
        else this.style.removeProperty('--bs-subtitle-font-size')

        const mw = this.maxWidth
        if (mw != null) this.style.setProperty('--bs-subtitle-max-width', `${mw}px`)
        else this.style.removeProperty('--bs-subtitle-max-width')

        const speakerHtml = this.speaker
            ? `<span class="tc-subtitle__speaker">${esc(this.speaker)}</span>`
            : ''

        patchHtml(this, `${speakerHtml}<span class="tc-subtitle__text">${esc(this.text)}</span>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Subtitle
    }
}
