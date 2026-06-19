import { esc } from './internal/esc'
const TAG_NAME = 'tc-invite-toast'

const DEFAULT_TIMEOUT = 15

export class InviteToast extends HTMLElement {
    private _initialised = false
    private _timer: ReturnType<typeof setInterval> | null = null
    private _remaining = 0

    // Optional callback properties, fired alongside the tc-* CustomEvents.
    onAccept: (() => void) | null = null
    onDecline: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['open', 'inviter', 'body', 'timeout-seconds']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Detach before attach to prevent double-registration on reconnect.
        this._detachHandlers()
        this._attachHandlers()
        if (this.open) this._startTimer()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._stopTimer()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return

        if (name === 'open') {
            // Visibility is purely CSS-driven via the [open] selector; here we only
            // manage the countdown. Restarting resets the bar + countdown text.
            if (this.open) this._startTimer()
            else this._stopTimer()
            return
        }

        if (name === 'timeout-seconds') {
            this.render()
            if (this.open) this._startTimer()
            return
        }

        this.render()
    }

    // ── Reflected attributes ───────────────────────────────────────────────────

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(v: boolean) {
        if (v) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get inviter(): string {
        return this.getAttribute('inviter') ?? ''
    }
    set inviter(v: string) {
        if (v) this.setAttribute('inviter', v)
        else this.removeAttribute('inviter')
    }

    get body(): string {
        return this.getAttribute('body') ?? ''
    }
    set body(v: string) {
        if (v) this.setAttribute('body', v)
        else this.removeAttribute('body')
    }

    get timeoutSeconds(): number {
        const raw = this.getAttribute('timeout-seconds')
        if (raw == null) return DEFAULT_TIMEOUT
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT
    }
    set timeoutSeconds(v: number) {
        this.setAttribute('timeout-seconds', String(v))
    }

    // ── Countdown timer ────────────────────────────────────────────────────────

    private _stopTimer(): void {
        if (this._timer != null) {
            clearInterval(this._timer)
            this._timer = null
        }
    }

    private _startTimer(): void {
        this._stopTimer()
        this._remaining = this.timeoutSeconds
        this._updateCountdown()
        this._timer = setInterval(() => {
            this._remaining -= 1
            this._updateCountdown()
            if (this._remaining <= 0) {
                this._stopTimer()
                this._emitDecline()
            }
        }, 1000)
    }

    private _updateCountdown(): void {
        const total = this.timeoutSeconds
        const pct = Math.max(0, Math.min(1, this._remaining / total))
        const fill = this.querySelector<HTMLElement>('.tc-invite-toast__bar-fill')
        if (fill) fill.style.width = `${(pct * 100).toFixed(2)}%`
        const count = this.querySelector<HTMLElement>('.tc-invite-toast__countdown')
        if (count) count.textContent = `${Math.max(0, Math.ceil(this._remaining))}s`
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    private _emitAccept(): void {
        this._stopTimer()
        this.dispatchEvent(
            new CustomEvent('tc-accept', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onAccept === 'function') this.onAccept()
    }

    private _emitDecline(): void {
        this._stopTimer()
        this.dispatchEvent(
            new CustomEvent('tc-decline', { bubbles: true, composed: true, detail: {} }),
        )
        if (typeof this.onDecline === 'function') this.onDecline()
    }

    // ── Listeners ──────────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const target = e.target as Element | null
        if (!target) return
        if (target.closest('.tc-invite-toast__accept')) {
            this._emitAccept()
        } else if (target.closest('.tc-invite-toast__decline')) {
            this._emitDecline()
        }
    }

    private _attachHandlers(): void {
        this.addEventListener('click', this._onClick)
    }

    private _detachHandlers(): void {
        this.removeEventListener('click', this._onClick)
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')

        const inviter = this.inviter || 'Unknown'
        const body = this.body || 'Wants to invite you to a party.'
        const initial = `${Math.max(0, Math.ceil(this.timeoutSeconds))}s`

        this.innerHTML =
            `<div class="tc-invite-toast__panel">` +
            `<div class="tc-invite-toast__header">` +
            `<span class="tc-invite-toast__eyebrow">Invite</span>` +
            `<span class="tc-invite-toast__countdown" aria-hidden="true">${initial}</span>` +
            `</div>` +
            `<div class="tc-invite-toast__inviter">${esc(inviter)}</div>` +
            `<p class="tc-invite-toast__body">${esc(body)}</p>` +
            `<div class="tc-invite-toast__bar" aria-hidden="true"><div class="tc-invite-toast__bar-fill"></div></div>` +
            `<div class="tc-invite-toast__actions">` +
            `<button type="button" class="btn btn-outline-secondary btn-sm tc-invite-toast__decline">Decline</button>` +
            `<button type="button" class="btn btn-primary btn-sm tc-invite-toast__accept">Accept</button>` +
            `</div>` +
            `</div>`

        this._updateCountdown()
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InviteToast
    }
}
