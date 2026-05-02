const TAG_NAME = 'gc-party-panel'

export interface PartyMember {
    id: string
    name: string
    ready?: boolean
    host?: boolean
    role?: string
}

export interface PartyPanelEventMap {
    leave: CustomEvent<void>
    invite: CustomEvent<void>
}

export class PartyPanel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['capacity']
    }

    private _members: PartyMember[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
    }

    get capacity(): number {
        const raw = this.getAttribute('capacity')
        if (raw == null) return 4
        const parsed = parseInt(raw, 10)
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 4
    }
    set capacity(v: number) {
        this.setAttribute('capacity', String(v))
    }

    get members(): PartyMember[] {
        return this._members.slice()
    }
    set members(value: PartyMember[]) {
        this._members = Array.isArray(value) ? value.slice() : []
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

    private render(): void {
        const capacity = this.capacity
        const members = this._members.slice(0, capacity)
        const slots: string[] = []

        for (let i = 0; i < capacity; i++) {
            const m = members[i]
            if (m) {
                const cls = `gc-party-panel-slot is-filled${m.ready ? ' is-ready' : ''}`
                const hostMarkup = m.host ? `<span class="gc-party-panel-host">★</span>` : ''
                const roleMarkup = m.role
                    ? `<span class="gc-party-panel-role">${this.escape(m.role)}</span>`
                    : ''
                const readyMarkup = m.ready
                    ? `<span class="gc-party-panel-ready">Ready</span>`
                    : `<span class="gc-party-panel-not-ready">Waiting</span>`
                slots.push(`<div class="${cls}" data-id="${this.escape(m.id)}">
                    ${hostMarkup}
                    <span class="gc-party-panel-name">${this.escape(m.name)}</span>
                    ${roleMarkup}
                    ${readyMarkup}
                </div>`)
            } else {
                slots.push(`<button type="button" class="gc-party-panel-slot is-empty" data-action="invite">
                    <span class="gc-party-panel-empty-glyph">＋</span>
                    <span class="gc-party-panel-empty-label">Invite</span>
                </button>`)
            }
        }

        this.innerHTML = `
            <div class="gc-party-panel-header">
                <gc-eyebrow class="gc-party-panel-eyebrow">Party</gc-eyebrow>
                <span class="gc-party-panel-count">${members.length}/${capacity}</span>
            </div>
            <div class="gc-party-panel-slots">${slots.join('')}</div>
            <div class="gc-party-panel-actions">
                <button type="button" class="gc-party-panel-leave">Leave Party</button>
            </div>
        `

        this.querySelectorAll<HTMLButtonElement>('.gc-party-panel-slot.is-empty').forEach((el) => {
            el.addEventListener('click', () => this.emit('invite'))
        })
        const leaveBtn = this.querySelector('.gc-party-panel-leave') as HTMLButtonElement | null
        if (leaveBtn) leaveBtn.addEventListener('click', () => this.emit('leave'))
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, PartyPanel)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PartyPanel
    }
}
