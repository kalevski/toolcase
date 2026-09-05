import { setHostClass } from './internal/host-class'
import { bindOnce, patchHtml } from './internal/patch-html'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-image'

export type ImageObjectFit = 'cover' | 'contain' | 'fill' | 'none'
const OBJECT_FITS: ImageObjectFit[] = ['cover', 'contain', 'fill', 'none']

// Pre-compute at module load: the broken-image fallback icon.
// 'Image' is the JS global constructor for HTMLImageElement — class is TcImage internally.
const imageOffSvg = (LucideIcons as Record<string, string>)['ImageOff'] ?? ''
const imageOffIconHtml = imageOffSvg ? icon(imageOffSvg, 'tc-image-fallback-icon') : ''

// Class named TcImage internally to avoid shadowing the global HTMLImageElement constructor (window.Image).
class TcImage extends HTMLElement {
    onLoad: (() => void) | null = null
    onError: (() => void) | null = null

    private _initialised = false
    private _state: 'loading' | 'loaded' | 'error' = 'loading'
    private _imgEl: HTMLImageElement | null = null

    private _onImgLoad = (): void => {
        this._state = 'loaded'
        this._patchState()
        this.dispatchEvent(
            new CustomEvent('tc-load', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onLoad === 'function') this.onLoad()
    }

    private _onImgError = (): void => {
        this._state = 'error'
        this._patchState()
        this.dispatchEvent(
            new CustomEvent('tc-error', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onError === 'function') this.onError()
    }

    static get observedAttributes(): string[] {
        return ['src', 'alt', 'aspect-ratio', 'object-fit']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._state = 'loading'
            this._initialised = true
            this.render()
        }
        this._wireImg()
    }

    disconnectedCallback(): void {
        this._unwireImg()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'src') this._state = 'loading'
        this._unwireImg()
        this.render()
        this._wireImg()
    }

    get src(): string | null {
        return this.getAttribute('src')
    }
    set src(v: string | null) {
        if (v != null) this.setAttribute('src', v)
        else this.removeAttribute('src')
    }

    get alt(): string | null {
        return this.getAttribute('alt')
    }
    set alt(v: string | null) {
        if (v != null) this.setAttribute('alt', v)
        else this.removeAttribute('alt')
    }

    get aspectRatio(): string | null {
        return this.getAttribute('aspect-ratio')
    }
    set aspectRatio(v: string | null) {
        if (v != null) this.setAttribute('aspect-ratio', v)
        else this.removeAttribute('aspect-ratio')
    }

    get objectFit(): ImageObjectFit {
        const v = this.getAttribute('object-fit') as ImageObjectFit
        return OBJECT_FITS.includes(v) ? v : 'cover'
    }
    set objectFit(v: ImageObjectFit) {
        setAttr(this, 'object-fit', v)
    }

    private render(): void {
        const src = this.src
        const alt = this.alt ?? ''
        const aspectRatio = this.aspectRatio
        const objectFit = this.objectFit
        const state = this._state

        const imgStyle = `object-fit:${objectFit}`
        const skeletonRole = state === 'loading' ? ' role="status"' : ''
        // Omit src when null to avoid spurious browser error events for empty src.
        const srcAttr = src != null ? ` src="${this._esc(src)}"` : ''

        // THE HOST IS THE FRAME. The skeleton, the image and the default fallback
        // glyph are element-owned and prepended; a fallback the consumer slotted
        // stays their child and CSS shows it only in the error state (rule 1).
        setHostClass(this, `tc-image tc-image--${state}`)
        this.style.aspectRatio = aspectRatio ?? ''
        patchHtml(
            this,
            `<div class="tc-image-skeleton" aria-hidden="true"${skeletonRole}></div>` +
                `<img class="tc-image-img"${srcAttr} alt="${this._esc(alt)}" style="${imgStyle}">` +
                `<span class="tc-image-fallback-default">${imageOffIconHtml}</span>`,
        )
    }

    private _patchState(): void {
        // THE HOST IS THE FRAME (see render()): '.tc-image' is a class on `this`,
        // not a descendant, so querySelector('.tc-image') never matched anything
        // and this used to be a silent no-op — the loading skeleton stayed put and
        // the <img> stayed at opacity:0 forever, even after a real load/error.
        // Go through setHostClass (the same call render() makes) so the host's
        // state modifier class actually updates and the applied-classes bookkeeping
        // stays in sync with what render() would compute next time.
        setHostClass(this, `tc-image tc-image--${this._state}`)
    }

    private _wireImg(): void {
        this._imgEl = this.querySelector<HTMLImageElement>('.tc-image-img')
        if (this._imgEl) {
            bindOnce(this._imgEl, 'load', this._onImgLoad)
            bindOnce(this._imgEl, 'error', this._onImgError)
        }
    }

    private _unwireImg(): void {
        if (this._imgEl) {
            this._imgEl.removeEventListener('load', this._onImgLoad)
            this._imgEl.removeEventListener('error', this._onImgError)
            this._imgEl = null
        }
    }

    private _esc(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
    }
}

// Re-export as 'Image' for the public API; the internal name avoids shadowing
// the global HTMLImageElement constructor (window.Image).
export { TcImage as Image }

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TcImage
    }
}
