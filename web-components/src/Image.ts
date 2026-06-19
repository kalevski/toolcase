import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

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
    private _fallbackNodes: Node[] = []

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
            this._fallbackNodes = Array.from(this.childNodes)
            this.render()
            this._distributeFallback()
            this._wireImg()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._unwireImg()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'src') this._state = 'loading'
        this._recaptureFallback()
        this._unwireImg()
        this.render()
        this._distributeFallback()
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
        this.setAttribute('object-fit', v)
    }

    private render(): void {
        const src = this.src
        const alt = this.alt ?? ''
        const aspectRatio = this.aspectRatio
        const objectFit = this.objectFit
        const state = this._state

        const wrapperStyle = aspectRatio ? ` style="aspect-ratio:${this._esc(aspectRatio)}"` : ''
        const imgStyle = `object-fit:${objectFit}`
        const skeletonRole = state === 'loading' ? ' role="status"' : ''
        // Omit src when null to avoid spurious browser error events for empty src.
        const srcAttr = src != null ? ` src="${this._esc(src)}"` : ''

        this.innerHTML = `<div class="tc-image tc-image--${state}"${wrapperStyle}><div class="tc-image-skeleton" aria-hidden="true"${skeletonRole}></div><img class="tc-image-img"${srcAttr} alt="${this._esc(alt)}" style="${imgStyle}"><div class="tc-image-fallback"><span class="tc-image-fallback-default">${imageOffIconHtml}</span></div></div>`
    }

    private _distributeFallback(): void {
        if (this._fallbackNodes.length === 0) return
        const fallbackEl = this.querySelector('.tc-image-fallback')
        if (!fallbackEl) return
        fallbackEl.innerHTML = ''
        this._fallbackNodes.forEach((n) => fallbackEl.appendChild(n))
    }

    private _recaptureFallback(): void {
        const fallbackEl = this.querySelector('.tc-image-fallback')
        if (!fallbackEl) return
        const captured = Array.from(fallbackEl.childNodes).filter(
            (n) => !(n instanceof Element && n.classList.contains('tc-image-fallback-default')),
        )
        if (captured.length > 0) this._fallbackNodes = captured
    }

    private _patchState(): void {
        const wrapper = this.querySelector<HTMLElement>('.tc-image')
        if (!wrapper) return
        wrapper.classList.remove('tc-image--loading', 'tc-image--loaded', 'tc-image--error')
        wrapper.classList.add(`tc-image--${this._state}`)
    }

    private _wireImg(): void {
        this._imgEl = this.querySelector<HTMLImageElement>('.tc-image-img')
        if (this._imgEl) {
            this._imgEl.addEventListener('load', this._onImgLoad)
            this._imgEl.addEventListener('error', this._onImgError)
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
