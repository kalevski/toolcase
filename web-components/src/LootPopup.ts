import { DialogBase, esc } from './internal/dialog-base'
import { msg } from './messages'
import { closeIcon } from './icons'
import type { LootEntry } from './LootList'

const TAG_NAME = 'tc-loot-popup'

/**
 * tc-loot-popup — a centered loot-reward modal on the shared {@link DialogBase}
 * scaffold. Adds the loot-list body, take/take-all/discard events, and an
 * optional auto-fade timer (wired through the onOpened/onClosing hooks).
 */
export class LootPopup extends DialogBase {
    private _items: LootEntry[] = []
    private _fadeTimer: ReturnType<typeof setTimeout> | null = null

    onTake: ((id: string) => void) | null = null
    onTakeAll: (() => void) | null = null
    onDiscard: (() => void) | null = null
    onClose: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'popup-title', 'eyebrow', 'discard-label', 'auto-fade-ms']
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

    // ── DialogBase hooks ─────────────────────────────────────────────────────────

    protected onCloseRequest(): void {
        this._requestClose()
    }

    // Auto-fade is tied to the open lifecycle.
    protected onOpened(): void {
        this._scheduleAutoFade()
    }
    protected onClosing(): void {
        this._clearAutoFade()
    }

    protected onBodyClick(e: MouseEvent): void {
        if ((e.target as Element)?.closest('.tc-loot-popup__close')) {
            this._requestClose()
        }
    }

    disconnectedCallback(): void {
        super.disconnectedCallback()
        this._clearAutoFade()
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

    private _requestClose(): void {
        this.dispatchEvent(
            new CustomEvent('tc-close', {
                bubbles: true,
                composed: true,
                detail: {},
            }),
        )
        if (typeof this.onClose === 'function') this.onClose()
    }

    // ── Inner wiring (loot-list + action buttons, re-wired each render) ──────────

    private _syncItems(): void {
        const list = this.querySelector<HTMLElement & { items?: LootEntry[] }>(
            '.tc-loot-popup__list',
        )
        if (list) list.items = this._items.slice()
    }

    private _wireInner(): void {
        const list = this.querySelector('.tc-loot-popup__list')
        if (list) {
            list.addEventListener('tc-take', (e: Event) => {
                e.stopPropagation()
                const id = (e as CustomEvent<{ id: string }>).detail.id
                this.dispatchEvent(
                    new CustomEvent('tc-take', {
                        bubbles: true,
                        composed: true,
                        detail: { id },
                    }),
                )
                if (typeof this.onTake === 'function') this.onTake(id)
                this._scheduleAutoFade()
            })
            list.addEventListener('tc-take-all', (e: Event) => {
                e.stopPropagation()
                this.dispatchEvent(
                    new CustomEvent('tc-take-all', {
                        bubbles: true,
                        composed: true,
                        detail: {},
                    }),
                )
                if (typeof this.onTakeAll === 'function') this.onTakeAll()
            })
        }

        const discard = this.querySelector<HTMLButtonElement>('.tc-loot-popup__discard')
        discard?.addEventListener('click', () => {
            this.dispatchEvent(
                new CustomEvent('tc-discard', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }),
            )
            if (typeof this.onDiscard === 'function') this.onDiscard()
        })

        const takeAll = this.querySelector<HTMLButtonElement>('.tc-loot-popup__take-all')
        takeAll?.addEventListener('click', () => {
            this.dispatchEvent(
                new CustomEvent('tc-take-all', {
                    bubbles: true,
                    composed: true,
                    detail: {},
                }),
            )
            if (typeof this.onTakeAll === 'function') this.onTakeAll()
        })
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    protected render(): void {
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
            `<button type="button" class="tc-loot-popup__close" aria-label="${esc(msg('close'))}">${closeIcon}</button>` +
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
