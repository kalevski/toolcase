import { esc } from './internal/esc'
// tc-lightbox — modal image gallery (overlay tier). Fully custom (no Bootstrap
// plugin). Port of @toolcase/react-components Lightbox. All cosmetics flow
// through --bs-lightbox-* vars backed by --tc-* tokens.

import { closeIcon, chevronLeftIcon, chevronRightIcon } from './icons'
import { lockBody, unlockBody } from './internal/scroll-lock'

const TAG_NAME = 'tc-lightbox'

let _idCounter = 0

export interface LightboxImage {
    src: string
    alt?: string
    caption?: string
    thumb?: string
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter((el) => !el.closest('[hidden]') && el.tabIndex >= 0)
}

const SWIPE_THRESHOLD = 40

export class Lightbox extends HTMLElement {
    private _initialised = false
    private _images: LightboxImage[] = []
    private _index = 0
    private _previousFocus: Element | null = null
    private _idPrefix: string

    // Pointer-swipe state.
    private _swipeStartX = 0
    private _dragging = false

    onclose: (() => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-lightbox-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'initial-index']
    }

    connectedCallback(): void {
        this._initialised = true
        // Detach before attach to prevent double-registration on reconnect.
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._applyOpenState(true)
        else this.render()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._restoreScroll()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'open') {
            this._applyOpenState(this.open)
            return
        }
        // initial-index only matters at the moment of opening; ignore otherwise.
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get initialIndex(): number {
        const n = parseInt(this.getAttribute('initial-index') ?? '0', 10)
        return Number.isFinite(n) ? n : 0
    }
    set initialIndex(v: number) {
        this.setAttribute('initial-index', String(v))
    }

    get images(): LightboxImage[] {
        return this._images
    }
    set images(v: LightboxImage[]) {
        this._images = Array.isArray(v) ? v : []
        if (this._initialised && this.open) {
            this._index = this._clampIndex(this._index)
            this.render()
            this._setOpenClass(true)
            this._focusDialog()
        }
    }

    // ── Open / close lifecycle ───────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        if (opening) {
            this._previousFocus = document.activeElement
            this._index = this._clampIndex(this.initialIndex)
            this.render()
            // Settle one frame before adding open class to trigger transition.
            requestAnimationFrame(() => {
                if (!this.open) return
                this._setOpenClass(true)
                this._lockScroll()
                this._focusDialog()
            })
        } else {
            this._setOpenClass(false)
            this._restoreScroll()
            this._restoreFocus()
            const delay = this._getTransitionDuration(
                this.querySelector<HTMLElement>('.tc-lightbox__backdrop'),
            )
            setTimeout(() => {
                if (!this.open) this.innerHTML = ''
            }, delay)
        }
    }

    private _getTransitionDuration(el: HTMLElement | null): number {
        if (!el) return 0
        const raw = getComputedStyle(el).transitionDuration || '0s'
        let max = 0
        for (const p of raw.split(',')) {
            const sec = parseFloat(p.trim())
            if (!isNaN(sec)) max = Math.max(max, sec)
        }
        return max * 1000
    }

    private _setOpenClass(on: boolean): void {
        if (on) this.classList.add('tc-lightbox--open')
        else this.classList.remove('tc-lightbox--open')
    }

    private _lockScroll(): void {
        lockBody()
    }

    private _restoreScroll(): void {
        unlockBody()
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) this._previousFocus.focus()
        this._previousFocus = null
    }

    private _focusDialog(): void {
        const dialog = this.querySelector<HTMLElement>('.tc-lightbox__dialog')
        dialog?.focus()
    }

    // ── Navigation ───────────────────────────────────────────────────────────────

    private _clampIndex(i: number): number {
        const n = this._images.length
        if (n === 0) return 0
        return ((i % n) + n) % n
    }

    private _goTo(i: number): void {
        const n = this._images.length
        if (n === 0) return
        const next = this._clampIndex(i)
        if (next === this._index) return
        this._index = next
        this._patchActive()
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { index: next },
            }),
        )
    }

    private _prev(): void {
        this._goTo(this._index - 1)
    }

    private _next(): void {
        this._goTo(this._index + 1)
    }

    // ── Event handlers ───────────────────────────────────────────────────────────

    private _requestClose(): void {
        this.dispatchEvent(
            new CustomEvent('tc-close', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onclose === 'function') this.onclose()
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        switch (e.key) {
            case 'Escape':
                e.preventDefault()
                this._requestClose()
                break
            case 'ArrowLeft':
                e.preventDefault()
                this._prev()
                break
            case 'ArrowRight':
                e.preventDefault()
                this._next()
                break
            case 'Home':
                e.preventDefault()
                this._goTo(0)
                break
            case 'End':
                e.preventDefault()
                this._goTo(this._images.length - 1)
                break
            case 'Tab': {
                const dialog = this.querySelector<HTMLElement>('.tc-lightbox__dialog')
                if (!dialog) return
                const focusable = getFocusable(dialog)
                if (focusable.length === 0) {
                    e.preventDefault()
                    dialog.focus()
                    return
                }
                const first = focusable[0]
                const last = focusable[focusable.length - 1]
                const active = document.activeElement
                if (e.shiftKey) {
                    if (active === first || active === dialog) {
                        e.preventDefault()
                        last.focus()
                    }
                } else {
                    if (active === last) {
                        e.preventDefault()
                        first.focus()
                    }
                }
                break
            }
        }
    }

    private _onClick = (e: MouseEvent): void => {
        if (!this.open) return
        const target = e.target as Element
        if (target.closest('.tc-lightbox__close')) {
            this._requestClose()
            return
        }
        if (target.closest('.tc-lightbox__arrow--prev')) {
            this._prev()
            return
        }
        if (target.closest('.tc-lightbox__arrow--next')) {
            this._next()
            return
        }
        const thumb = target.closest<HTMLElement>('.tc-lightbox__thumbnail')
        if (thumb) {
            this._goTo(parseInt(thumb.dataset.idx ?? '0', 10))
            return
        }
        // Clicking the image itself does nothing; anywhere else (backdrop, dialog
        // padding, stage gap) dismisses.
        if (target.closest('.tc-lightbox__image')) return
        this._requestClose()
    }

    private _onPointerDown = (e: PointerEvent): void => {
        if (!this.open) return
        const target = e.target as Element
        if (!target.closest('.tc-lightbox__stage')) return
        if (target.closest('button')) return
        this._dragging = true
        this._swipeStartX = e.clientX
    }

    private _onPointerUp = (e: PointerEvent): void => {
        if (!this._dragging) return
        this._dragging = false
        const diff = e.clientX - this._swipeStartX
        if (Math.abs(diff) > SWIPE_THRESHOLD) {
            if (diff < 0) this._next()
            else this._prev()
        }
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('pointerup', this._onPointerUp)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('pointerup', this._onPointerUp)
    }

    // ── Rendering ────────────────────────────────────────────────────────────────

    private _patchActive(): void {
        const img = this._images[this._index]
        if (!img) return
        const count = this._images.length

        const imgEl = this.querySelector<HTMLImageElement>('.tc-lightbox__image')
        if (imgEl) {
            imgEl.src = img.src
            imgEl.alt = img.alt ?? `Image ${this._index + 1} of ${count}`
        }

        const caption = this.querySelector<HTMLElement>('.tc-lightbox__caption')
        if (caption) {
            if (img.caption) {
                caption.textContent = img.caption
                caption.hidden = false
            } else {
                caption.textContent = ''
                caption.hidden = true
            }
        }

        const counter = this.querySelector<HTMLElement>('.tc-lightbox__counter')
        if (counter) counter.textContent = `${this._index + 1} / ${count}`

        this.querySelectorAll<HTMLElement>('.tc-lightbox__thumbnail').forEach((btn, idx) => {
            const active = idx === this._index
            btn.classList.toggle('tc-lightbox__thumbnail--active', active)
            if (active) btn.setAttribute('aria-current', 'true')
            else btn.removeAttribute('aria-current')
        })
    }

    private render(): void {
        if (!this.open || this._images.length === 0) {
            this.innerHTML = ''
            return
        }

        const count = this._images.length
        const img = this._images[this._index]
        const labelId = `${this._idPrefix}-label`
        const multi = count > 1

        const arrowsPrev = multi
            ? `<button type="button" class="tc-lightbox__arrow tc-lightbox__arrow--prev" aria-label="Previous image">${chevronLeftIcon}</button>`
            : ''
        const arrowsNext = multi
            ? `<button type="button" class="tc-lightbox__arrow tc-lightbox__arrow--next" aria-label="Next image">${chevronRightIcon}</button>`
            : ''

        const captionText = img.caption ? esc(img.caption) : ''
        const captionHidden = img.caption ? '' : ' hidden'

        const thumbsHtml = multi
            ? `<div class="tc-lightbox__thumbnails" aria-label="Image thumbnails">` +
              this._images
                  .map((image, idx) => {
                      const active = idx === this._index
                      const cls = `tc-lightbox__thumbnail${active ? ' tc-lightbox__thumbnail--active' : ''}`
                      const current = active ? ' aria-current="true"' : ''
                      const src = esc(image.thumb ?? image.src)
                      const label = esc(`View image ${idx + 1}${image.alt ? `: ${image.alt}` : ''}`)
                      return (
                          `<button type="button" class="${cls}" data-idx="${idx}" aria-label="${label}"${current}>` +
                          `<img src="${src}" alt="" aria-hidden="true" loading="lazy" /></button>`
                      )
                  })
                  .join('') +
              `</div>`
            : ''

        this.innerHTML =
            `<div class="tc-lightbox__backdrop" aria-hidden="true"></div>` +
            `<div class="tc-lightbox__dialog" role="dialog" aria-modal="true"` +
            ` aria-label="Image gallery" aria-labelledby="${labelId}" tabindex="-1">` +
            `<button type="button" class="tc-lightbox__close" aria-label="Close lightbox">${closeIcon}</button>` +
            `<div class="tc-lightbox__counter" id="${labelId}" aria-live="polite">${this._index + 1} / ${count}</div>` +
            `<div class="tc-lightbox__stage">` +
            arrowsPrev +
            `<figure class="tc-lightbox__figure">` +
            `<img class="tc-lightbox__image" src="${esc(img.src)}" alt="${esc(img.alt ?? `Image ${this._index + 1} of ${count}`)}" />` +
            `<figcaption class="tc-lightbox__caption"${captionHidden}>${captionText}</figcaption>` +
            `</figure>` +
            arrowsNext +
            `</div>` +
            thumbsHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Lightbox
    }
}
