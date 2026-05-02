const TAG_NAME = 'gc-report-player-dialog'

const DEFAULT_REASONS = [
    'Cheating / hacks',
    'Toxic behavior',
    'Inappropriate name',
    'Griefing / sabotage',
    'Other',
]

export interface ReportPlayerDialogEventMap {
    cancel: CustomEvent<void>
    submit: CustomEvent<{ reason: string, comment: string }>
}

export class ReportPlayerDialog extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['open', 'player-name']
    }

    private _reasons: string[] = DEFAULT_REASONS
    private selectedReason = ''
    private comment = ''
    private keyHandler = (event: KeyboardEvent) => this.handleKey(event)

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'dialog')
        this.setAttribute('aria-modal', 'true')
        document.addEventListener('keydown', this.keyHandler)
        this.render()
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler)
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get open(): boolean {
        return this.hasAttribute('open')
    }
    set open(value: boolean) {
        if (value) this.setAttribute('open', '')
        else this.removeAttribute('open')
    }

    get playerName(): string {
        return this.getAttribute('player-name') ?? ''
    }
    set playerName(v: string) {
        if (v) this.setAttribute('player-name', v)
        else this.removeAttribute('player-name')
    }

    get reasons(): string[] {
        return this._reasons
    }
    set reasons(value: string[]) {
        this._reasons = Array.isArray(value) && value.length ? value : DEFAULT_REASONS
        if (this.isConnected) this.render()
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

    private handleKey(event: KeyboardEvent): void {
        if (!this.open) return
        if (event.key === 'Escape') {
            event.preventDefault()
            this.emit('cancel')
        }
    }

    private render(): void {
        const reasonMarkup = this._reasons.map((reason, idx) => {
            const checked = reason === this.selectedReason
            return `<label class="gc-report-player-dialog-reason${checked ? ' is-checked' : ''}">
                <input type="radio" name="gc-report-reason" value="${this.escape(reason)}" ${checked ? 'checked' : ''} data-idx="${idx}" />
                <span class="gc-report-player-dialog-radio"></span>
                <span class="gc-report-player-dialog-reason-label">${this.escape(reason)}</span>
            </label>`
        }).join('')

        this.innerHTML = `
            <div class="gc-report-player-dialog-backdrop" data-gc-backdrop></div>
            <div class="gc-report-player-dialog-panel" role="document">
                <gc-eyebrow class="gc-report-player-dialog-eyebrow">Report Player</gc-eyebrow>
                <gc-title class="gc-report-player-dialog-title">${this.escape(this.playerName || 'Unknown')}</gc-title>
                <div class="gc-report-player-dialog-divider"><span class="gc-report-player-dialog-rule"></span><span class="gc-report-player-dialog-diamond"></span><span class="gc-report-player-dialog-rule"></span></div>
                <div class="gc-report-player-dialog-message">Select the reason this player should be reported. Your report stays anonymous.</div>
                <div class="gc-report-player-dialog-reasons" role="radiogroup">${reasonMarkup}</div>
                <textarea class="gc-report-player-dialog-comment" placeholder="Additional details (optional)">${this.escape(this.comment)}</textarea>
                <div class="gc-report-player-dialog-actions">
                    <gc-metal-button class="gc-report-player-dialog-cancel" variant="ghost">Cancel</gc-metal-button>
                    <gc-metal-button class="gc-report-player-dialog-submit" variant="danger" ${this.selectedReason ? '' : 'disabled'}>Submit Report</gc-metal-button>
                </div>
            </div>
        `

        const backdrop = this.querySelector('[data-gc-backdrop]') as HTMLElement | null
        backdrop?.addEventListener('click', () => this.emit('cancel'))

        this.querySelectorAll<HTMLInputElement>('input[name="gc-report-reason"]').forEach((input) => {
            input.addEventListener('change', () => {
                this.selectedReason = input.value
                this.render()
            })
        })

        const textarea = this.querySelector('.gc-report-player-dialog-comment') as HTMLTextAreaElement | null
        textarea?.addEventListener('input', () => {
            this.comment = textarea.value
        })

        const cancel = this.querySelector('.gc-report-player-dialog-cancel') as HTMLElement | null
        cancel?.addEventListener('click', () => this.emit('cancel'))

        const submit = this.querySelector('.gc-report-player-dialog-submit') as HTMLElement | null
        submit?.addEventListener('click', () => {
            if (!this.selectedReason) return
            this.emit('submit', { reason: this.selectedReason, comment: this.comment })
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ReportPlayerDialog
    }
}
