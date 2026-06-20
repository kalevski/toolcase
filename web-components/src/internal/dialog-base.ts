import { esc as escShared } from "./esc"
import { lockBody, unlockBody } from './scroll-lock'
import { overlayStack } from './overlay-stack'
// Shared scaffold for centered modal dialogs (tc-confirm-dialog,
// tc-report-dialog). Owns the open/close lifecycle, the one-frame transition
// dance, scroll-lock, focus trap + restore, Escape/Tab handling, and backdrop
// dismiss. The BEM root (`.${prefix}__backdrop` / `__panel`, `${prefix}--open`)
// is derived from the element's tag name. Subclasses own render() + their own
// buttons/emit logic via the hooks below. ~200 lines of identical scaffold that
// used to be copy-pasted per dialog now live here once.

let _idCounter = 0

export function esc(s: string): string {
    return escShared(s)
}

function getFocusable(root: Element): HTMLElement[] {
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            'a[href],area[href],button:not([disabled]),details>summary,[tabindex]:not([tabindex="-1"]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])',
        ),
    ).filter(el => !el.closest('[hidden]') && el.tabIndex >= 0)
}

export abstract class DialogBase extends HTMLElement {
    protected _initialised = false
    protected _previousFocus: Element | null = null
    protected _idPrefix: string

    constructor() {
        super()
        this._idPrefix = `${this.localName || 'tc-dialog'}-${++_idCounter}`
    }

    // ── Subclass hooks ─────────────────────────────────────────────────────────
    /** Build the element's innerHTML (backdrop + panel + body). */
    protected abstract render(): void
    /** Escape, backdrop click, and close affordances route here (usually cancel). */
    protected abstract onCloseRequest(): void
    /** Optional CSS selector inside the panel to focus first (else first focusable). */
    protected initialFocusSelector(): string | null {
        return null
    }
    /** Extra keydown handling (e.g. Enter → confirm). Call preventDefault to stop Tab handling. */
    protected onExtraKeydown(_e: KeyboardEvent): void {}
    /** Non-backdrop clicks inside the dialog (button routing). */
    protected onBodyClick(_e: MouseEvent): void {}
    /** Extra document/element listeners beyond keydown + click. */
    protected attachExtraHandlers(): void {}
    protected detachExtraHandlers(): void {}
    /** Whether opening locks body scroll. Override to false for non-modal/pinned overlays. */
    protected shouldLockScroll(): boolean {
        return true
    }
    /** Called synchronously once the dialog has opened (e.g. start an auto-dismiss timer). */
    protected onOpened(): void {}
    /** Called synchronously when the dialog begins closing (e.g. clear that timer). */
    protected onClosing(): void {}

    static get observedAttributes(): string[] {
        return ['open']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Detach before attach to prevent double-registration on reconnect.
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._applyOpenState(true)
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._restoreScroll()
        overlayStack.pop(this)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'open') {
            this._applyOpenState(this.open)
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

    protected get classPrefix(): string {
        return this.localName
    }

    // ── Open / close lifecycle ─────────────────────────────────────────────────

    protected _applyOpenState(opening: boolean): void {
        const p = this.classPrefix
        const panel = this.querySelector<HTMLElement>(`.${p}__panel`)
        const backdrop = this.querySelector<HTMLElement>(`.${p}__backdrop`)

        if (opening) {
            overlayStack.push(this)
            this._previousFocus = document.activeElement
            panel?.removeAttribute('hidden')
            backdrop?.removeAttribute('hidden')
            // Settle one frame before adding the open class to trigger the transition.
            requestAnimationFrame(() => {
                this.classList.add(`${p}--open`)
                panel?.setAttribute('aria-hidden', 'false')
                if (this.shouldLockScroll()) this._lockScroll()
                this._trapFocus(panel)
            })
            this.onOpened()
        } else {
            overlayStack.pop(this)
            this.onClosing()
            this.classList.remove(`${p}--open`)
            panel?.setAttribute('aria-hidden', 'true')
            if (this.shouldLockScroll()) this._restoreScroll()
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

    private _lockScroll(): void {
        lockBody()
    }

    private _restoreScroll(): void {
        unlockBody()
    }

    private _restoreFocus(): void {
        if (this._previousFocus instanceof HTMLElement) {
            this._previousFocus.focus()
        }
        this._previousFocus = null
    }

    private _trapFocus(panel: HTMLElement | null): void {
        if (!panel) return
        const sel = this.initialFocusSelector()
        const preferred = sel ? panel.querySelector<HTMLElement>(sel) : null
        const focusable = getFocusable(panel)
        if (preferred) preferred.focus()
        else if (focusable.length > 0) focusable[0].focus()
        else panel.focus()
    }

    // ── Listeners ──────────────────────────────────────────────────────────────

    private _onKeydown = (e: KeyboardEvent): void => {
        if (!this.open) return
        if (overlayStack.top() !== this) return
        if (e.key === 'Escape') {
            e.preventDefault()
            this.onCloseRequest()
            return
        }
        this.onExtraKeydown(e)
        if (e.defaultPrevented) return
        if (e.key === 'Tab') {
            const panel = this.querySelector<HTMLElement>(`.${this.classPrefix}__panel`)
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

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return
        if (target.classList.contains(`${this.classPrefix}__backdrop`)) {
            this.onCloseRequest()
            return
        }
        this.onBodyClick(e)
    }

    private _attachHandlers(): void {
        document.addEventListener('keydown', this._onKeydown)
        this.addEventListener('click', this._onClick)
        this.attachExtraHandlers()
    }

    private _detachHandlers(): void {
        document.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('click', this._onClick)
        this.detachExtraHandlers()
    }
}
