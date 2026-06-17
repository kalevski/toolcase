import { closeIcon } from './icons'
import type { LootEntry } from './LootList'

const TAG_NAME = 'tc-loot-popup'

let _idCounter = 0

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter(el => !el.closest('[hidden]') && el.tabIndex >= 0)
}

export class LootPopup extends HTMLElement {
    private _initialised = false
    private _items: LootEntry[] = []
    private _previousFocus: Element | null = null
    private _idPrefix: string
    private _fadeTimer: ReturnType<typeof setTimeout> | null = null

    onTake: ((id: string) => void) | null = null
    onTakeAll: (() => void) | null = null
    onDiscard: (() => void) | null = null
    onClose: (() => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-loot-popup-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['open', 'popup-title', 'eyebrow', 'discard-label', 'auto-fade-ms']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) {
            this._applyOpenState(true)
            this._scheduleAutoFade()
        }
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._clearAutoFade()
        this._restoreScroll()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            this._applyOpenState(this.open)
            this._scheduleAutoFade()
            return
        }

        if (name === 'auto-fade-ms') {
            this._scheduleAutoFade()
            return
        }

        // Structural attribute changed — re-render, then re-apply visibility.
        this.render()
        if (this.open) this._applyOpenState(true)
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get popupTitle(): string {
        return this.getAttribute('popup-title') ?? 'Loot'
    }
    set popupTitle(v: string) {
        if (v) this.setAttribute('popup-title', v)
        else this.removeAttribute('popup-title')
    }

    get eyebrow(): string {
        return this.getAttribute('eyebrow') ?? ''
    }
    set eyebrow(v: string) {
        if (v) this.setAttribute('eyebrow', v)
        else this.removeAttribute('eyebrow')
    }

    get discardLabel(): string {
        return this.getAttribute('discard-label') ?? 'Discard'
    }
    set discardLabel(v: string) {
        if (v) this.setAttribute('discard-label', v)
        else this.removeAttribute('discard-label')
    }

    get autoFadeMs(): number {
        const raw = this.getAttribute('auto-fade-ms')
        if (raw === null) return 0
        const parsed = Number(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
    }
    set autoFadeMs(v: number) {
        if (Number.isFinite(v) && v > 0) this.setAttribute('auto-fade-ms', String(v))
        else this.removeAttribute('auto-fade-ms')
    }

    get items(): LootEntry[] {
        return this._items.slice()
    }
    set items(value: LootEntry[]) {
        this._items = Array.isArray(value) ? value.slice() : []
        if (this._initialised) {
            this._syncItems()
            this._scheduleAutoFade()
        }
    }

    // ── Open / close lifecycle ─────────────────────────────────────────────────

    private _applyOpenState(opening: boolean): void {
        const panel = this.querySelector<HTMLElement>('.tc-loot-popup__panel')
        const backdrop = this.querySelector<HTMLElement>('.tc-loot-popup__backdrop')

        if (opening) {
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding the open class to trigger the transition.
            requestAnimationFrame(() => {
                this.classList.add('tc-loot-popup--open')
                panel?.setAttribute('aria-hidden', 'false')
                this._lockScroll()
                this._trapFocus(panel)
            })
        } else {
            this._clearAutoFade()
            this.classList.remove('tc-loot-popup--open')
            panel?.setAttribute('aria-hidden', 'true')
            this._restoreScroll()
            this._restoreFocus()
            const delay = this._getTransitionDuration(panel)
            setTimeout(() => {
                if (!this.open) {
                    panel?.setAttribute('hidden', '')
                    backdrop?.setAttribute('hidden', '')
                }
            }, delay)
        }
    }

    private _requestClose(): void {
        this.dispatchEvent(new CustomEvent('tc-close', {
            bubbles: true,
            composed: true,
            detail: {},
        }))
        if (typeof this.onClose === 'function') this.onClose()
    }

    // ── Auto-fade ──────────────────────────────────────────────────────────────

    private _clearAutoFade(): void {
        if (this._fadeTimer !== null) {
            clearTimeout(this._fadeTimer)
            this._fadeTimer = null
        }
    }

    private _scheduleAutoFade(): void {
        this._clearAutoFade()
        if (!this.open) return
        const ms = this.autoFadeMs
        if (ms <= 0) return
        this._fadeTimer = setTimeout(() => {
            this._fadeTimer = null
            this._requestClose()
        }, ms)
    }

    // ── Focus management ───────────────────────────────────────────────────────

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        const focusable = getFocusable(panel)
        if (focusable.length > 0) {
            focusable[0].focus()
        } else {
            panel.focus()
        }
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) {
            this._previousFocus.focus()
        }
        this._previousFocus = null
    }

    private _lockScroll(): void {
        document.body.style.overflow = 'hidden'
    }

    private _restoreScroll(): void {
        document.body.style.overflow = ''
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

    // ── Event handlers (arrow-property, stable references) ────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this._requestClose()
            return
        }
        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>('.tc-loot-popup__panel')
            if (!panel) return
            const focusable = getFocusable(panel)
            if (focusable.length === 0) return
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault()
                    last.focus()
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault()
                    first.focus()
                }
            }
        }
    }

    private _onBackdropClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.classList.contains('tc-loot-popup__backdrop')) {
            this._requestClose()
        }
    }

    private _onCloseClick = (e: MouseEvent): void => {
        if ((e.target as Element)?.closest('.tc-loot-popup__close')) {
            this._requestClose()
        }
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onBackdropClick)
        this.addEventListener('click', this._onCloseClick)
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onBackdropClick)
        this.removeEventListener('click', this._onCloseClick)
    }

    // ── Sync items ─────────────────────────────────────────────────────────────

    private _syncItems(): void {
        const list = this.querySelector<HTMLElement & { items?: LootEntry[] }>('.tc-loot-popup__list')
        if (list) list.items = this._items.slice()
    }

    // ── Inner-element listeners (wired fresh each render) ──────────────────────

    private _wireInner(): void {
        const list = this.querySelector('.tc-loot-popup__list')
        if (list) {
            list.addEventListener('tc-take', (e: Event) => {
                e.stopPropagation()
                const id = (e as CustomEvent<{ id: string }>).detail.id
                this.dispatchEvent(new CustomEvent('tc-take', {
                    bubbles: true,
                    composed: true,
                    detail: { id },
                }))
                if (typeof this.onTake === 'function') this.onTake(id)
                this._scheduleAutoFade()
            })
            list.addEventListener('tc-take-all', (e: Event) => {
                e.stopPropagation()
                this.dispatchEvent(new CustomEvent('tc-take-all', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }))
                if (typeof this.onTakeAll === 'function') this.onTakeAll()
            })
        }

        const discard = this.querySelector<HTMLButtonElement>('.tc-loot-popup__discard')
        discard?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('tc-discard', {
                bubbles: true,
                composed: true,
                detail: {},
            }))
            if (typeof this.onDiscard === 'function') this.onDiscard()
        })

        const takeAll = this.querySelector<HTMLButtonElement>('.tc-loot-popup__take-all')
        takeAll?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('tc-take-all', {
                bubbles: true,
                composed: true,
                detail: {},
            }))
            if (typeof this.onTakeAll === 'function') this.onTakeAll()
        })
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
        const isOpen = this.open
        const labelId = `${this._idPrefix}-title`
        const hiddenAttr = isOpen ? '' : ' hidden'
        const eyebrowText = this.getAttribute('eyebrow') ?? ''
        const titleText = this.getAttribute('popup-title') ?? 'Loot'
        const discardText = this.getAttribute('discard-label') ?? 'Discard'

        const eyebrowHtml = eyebrowText
            ? `<span class="tc-loot-popup__eyebrow">${esc(eyebrowText)}</span>`
            : ''

        this.innerHTML =
            `<div class="tc-loot-popup__backdrop" aria-hidden="true"${hiddenAttr}></div>` +
            `<div class="tc-loot-popup__panel" role="dialog" aria-modal="true"` +
            ` aria-labelledby="${labelId}" tabindex="-1"` +
            ` aria-hidden="${isOpen ? 'false' : 'true'}"${hiddenAttr}>` +
            `<div class="tc-loot-popup__header">` +
            eyebrowHtml +
            `<h2 class="tc-loot-popup__title" id="${labelId}">${esc(titleText)}</h2>` +
            `<button type="button" class="tc-loot-popup__close" aria-label="Close">${closeIcon}</button>` +
            `</div>` +
            `<tc-loot-list class="tc-loot-popup__list"></tc-loot-list>` +
            `<div class="tc-loot-popup__actions">` +
            `<button type="button" class="tc-loot-popup__btn tc-loot-popup__discard">${esc(discardText)}</button>` +
            `<button type="button" class="tc-loot-popup__btn tc-loot-popup__take-all">Take All</button>` +
            `</div>` +
            `</div>`

        if (isOpen) {
            this.classList.add('tc-loot-popup--open')
        } else {
            this.classList.remove('tc-loot-popup--open')
        }

        this._syncItems()
        this._wireInner()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LootPopup
    }
}
