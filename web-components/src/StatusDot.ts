import { esc } from './internal/esc'
const TAG_NAME = 'tc-status-dot'

let _uidCounter = 0

export type StatusDotStatus = 'online' | 'offline' | 'busy' | 'away'
export type StatusDotSize = 'small' | 'default' | 'large'

const STATUSES: StatusDotStatus[] = ['online', 'offline', 'busy', 'away']
const SIZES: StatusDotSize[] = ['small', 'default', 'large']

const STATUS_ARIA_LABELS: Record<StatusDotStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    busy: 'Busy',
    away: 'Away',
}

export class StatusDot extends HTMLElement {
    private _initialised = false
    private _labelId: string

    static get observedAttributes(): string[] {
        return ['status', 'size', 'label', 'pulse']
    }

    constructor() {
        super()
        this._labelId = `tc-status-dot-label-${++_uidCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get status(): StatusDotStatus {
        const v = this.getAttribute('status') as StatusDotStatus
        return STATUSES.includes(v) ? v : 'offline'
    }
    set status(v: StatusDotStatus) {
        this.setAttribute('status', v)
    }

    get size(): StatusDotSize {
        const v = this.getAttribute('size') as StatusDotSize
        return SIZES.includes(v) ? v : 'default'
    }
    set size(v: StatusDotSize) {
        this.setAttribute('size', v)
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get pulse(): boolean {
        return this.hasAttribute('pulse')
    }
    set pulse(v: boolean) {
        if (v) this.setAttribute('pulse', '')
        else this.removeAttribute('pulse')
    }

    private render(): void {
        const status = this.status
        const size = this.size
        const label = this.getAttribute('label')
        const pulse = this.hasAttribute('pulse')

        const pulseClass = pulse ? ' tc-status-dot-marker--pulse' : ''

        let markerAttrs: string
        let labelHtml = ''

        if (label != null) {
            // Visible label describes the status — point aria-labelledby at it.
            markerAttrs = `role="img" aria-labelledby="${this._labelId}"`
            labelHtml = `<span class="tc-status-dot-label" id="${this._labelId}">${esc(label)}</span>`
        } else {
            markerAttrs = `role="img" aria-label="${esc(STATUS_ARIA_LABELS[status])}"`
        }

        this.innerHTML = `<span class="tc-status-dot tc-status-dot-${size}"><span class="tc-status-dot-marker tc-status-dot-${status}${pulseClass}" ${markerAttrs}></span>${labelHtml}</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: StatusDot
    }
}
