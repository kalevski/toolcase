const TAG_NAME = 'gc-invite-toast'

export interface InviteToastEventMap {
    accept: CustomEvent<void>
    decline: CustomEvent<void>
}

export class InviteToast extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'inviter', 'body', 'timeout-seconds']
    }

    private timer: number | null = null
    private remaining = 0

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'status')
        this.setAttribute('aria-live', 'polite')
        this.render()
        if (this.open) this.startTimer()
    }

    disconnectedCallback(): void {
        this.stopTimer()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected) return
        if (name === 'open') {
            this.render()
            if (this.open) this.startTimer()
            else this.stopTimer()
            return
        }
        if (name === 'timeout-seconds') {
            if (this.open) this.startTimer()
            this.render()
            return
        }
        this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
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
        if (raw == null) return 15
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 15
    }
    set timeoutSeconds(v: number) {
        this.setAttribute('timeout-seconds', String(v))
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private stopTimer(): void {
        if (this.timer != null) {
            window.clearInterval(this.timer)
            this.timer = null
        }
    }

    private startTimer(): void {
        this.stopTimer()
        this.remaining = this.timeoutSeconds
        this.updateCountdown()
        this.timer = window.setInterval(() => {
            this.remaining -= 1
            this.updateCountdown()
            if (this.remaining <= 0) {
                this.stopTimer()
                this.emit('decline')
            }
        }, 1000)
    }

    private updateCountdown(): void {
        const total = this.timeoutSeconds
        const pct = Math.max(0, Math.min(1, this.remaining / total))
        const fill = this.querySelector('.gc-invite-toast-bar-fill') as HTMLElement | null
        if (fill) fill.style.width = `${(pct * 100).toFixed(2)}%`
        const count = this.querySelector('.gc-invite-toast-countdown') as HTMLElement | null
        if (count) count.textContent = `${Math.max(0, Math.ceil(this.remaining))}s`
    }

    private render(): void {
        const inviter = this.inviter || 'Unknown'
        const body = this.body || 'Wants to invite you to a party.'
        this.innerHTML = `
            <div class="gc-invite-toast-panel">
                <div class="gc-invite-toast-header">
                    <gc-eyebrow class="gc-invite-toast-eyebrow">Invite</gc-eyebrow>
                    <span class="gc-invite-toast-countdown">${Math.ceil(this.timeoutSeconds)}s</span>
                </div>
                <div class="gc-invite-toast-inviter">${this.escape(inviter)}</div>
                <div class="gc-invite-toast-body">${this.escape(body)}</div>
                <div class="gc-invite-toast-bar"><div class="gc-invite-toast-bar-fill"></div></div>
                <div class="gc-invite-toast-actions">
                    <gc-metal-button class="gc-invite-toast-decline" variant="ghost" size="sm">Decline</gc-metal-button>
                    <gc-metal-button class="gc-invite-toast-accept" variant="primary" size="sm">Accept</gc-metal-button>
                </div>
            </div>
        `
        this.updateCountdown()

        const accept = this.querySelector('.gc-invite-toast-accept') as HTMLElement | null
        accept?.addEventListener('click', () => {
            this.stopTimer()
            this.emit('accept')
        })
        const decline = this.querySelector('.gc-invite-toast-decline') as HTMLElement | null
        decline?.addEventListener('click', () => {
            this.stopTimer()
            this.emit('decline')
        })
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, InviteToast)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InviteToast
    }
}
