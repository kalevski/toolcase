const TAG_NAME = 'tc-gilded-frame'

export type GildedFrameTone = 'dark' | 'leather' | 'transparent'
export type GildedFramePadding = 'none' | 'sm' | 'md' | 'lg' | 'xl'

const TONES: GildedFrameTone[] = ['dark', 'leather', 'transparent']
const PADDINGS: GildedFramePadding[] = ['none', 'sm', 'md', 'lg', 'xl']

const DEFAULT_TONE: GildedFrameTone = 'dark'
const DEFAULT_PADDING: GildedFramePadding = 'md'

// Web-components port of game-components `gc-gilded-frame`. Drops the fantasy
// gilding/leather textures: it is now a plain toolcase hairline-framed surface
// wrapping its slotted content. The dark/leather/transparent tones map onto the
// slate neutral ramp (ink fill / muted slate / borderless transparent).
export class GildedFrame extends HTMLElement {

    private _initialised = false

    static get observedAttributes(): string[] {
        return ['tone', 'padding']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Mirror the source's reflected defaults so the attribute surface
            // matches `gc-gilded-frame` (tone=dark, padding=md when absent).
            if (!this.hasAttribute('tone')) this.setAttribute('tone', DEFAULT_TONE)
            if (!this.hasAttribute('padding')) this.setAttribute('padding', DEFAULT_PADDING)

            const slotContent = Array.from(this.childNodes)
            this.render()
            const inner = this.querySelector('.tc-gilded-frame-content')
            if (inner) slotContent.forEach(n => inner.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        const inner = this.querySelector('.tc-gilded-frame-content')
        const slotContent = inner ? Array.from(inner.childNodes) : []
        this.render()
        const newInner = this.querySelector('.tc-gilded-frame-content')
        if (newInner) slotContent.forEach(n => newInner.appendChild(n))
    }

    get tone(): GildedFrameTone {
        const v = this.getAttribute('tone') as GildedFrameTone
        return TONES.includes(v) ? v : DEFAULT_TONE
    }
    set tone(value: GildedFrameTone) {
        this.setAttribute('tone', value)
    }

    get padding(): GildedFramePadding {
        const v = this.getAttribute('padding') as GildedFramePadding
        return PADDINGS.includes(v) ? v : DEFAULT_PADDING
    }
    set padding(value: GildedFramePadding) {
        this.setAttribute('padding', value)
    }

    private render(): void {
        const tone = this.tone
        const padding = this.padding

        // Manage host classes via classList so author-supplied classes survive.
        this.classList.add('tc-gilded-frame')
        TONES.forEach(t => this.classList.remove(`tc-gilded-frame--tone-${t}`))
        PADDINGS.forEach(p => this.classList.remove(`tc-gilded-frame--pad-${p}`))
        this.classList.add(`tc-gilded-frame--tone-${tone}`)
        this.classList.add(`tc-gilded-frame--pad-${padding}`)

        this.innerHTML = `<div class="tc-gilded-frame-content"></div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GildedFrame
    }
}
