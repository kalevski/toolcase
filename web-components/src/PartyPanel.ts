import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-party-panel'

export interface PartyMember {
    id: string
    name: string
    ready?: boolean
    host?: boolean
    role?: string
}

export interface PartyPanelEventMap {
    'tc-leave': CustomEvent<Record<string, never>>
    'tc-invite': CustomEvent<Record<string, never>>
}

export class PartyPanel extends HTMLElement {
    private _initialised = false
    private _members: PartyMember[] = []

    onLeave: (() => void) | null = null
    onInvite: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['capacity']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'group')
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
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
        if (this._initialised) this.render()
    }

    private _emit(name: 'tc-leave' | 'tc-invite'): void {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail: {} }))
        if (name === 'tc-leave' && typeof this.onLeave === 'function') this.onLeave()
        else if (name === 'tc-invite' && typeof this.onInvite === 'function') this.onInvite()
    }

    private _renderSlot(i: number, members: PartyMember[]): string {
        const m = members[i]
        if (!m) {
            return `<button type="button" class="tc-party-panel-slot tc-party-panel-slot--empty" data-action="invite">
                <span class="tc-party-panel-invite-glyph" aria-hidden="true">+</span>
                <span class="tc-party-panel-invite-label">Invite</span>
            </button>`
        }

        const cls = [
            'tc-party-panel-slot',
            'tc-party-panel-slot--filled',
            m.ready ? 'tc-party-panel-slot--ready' : '',
        ]
            .filter(Boolean)
            .join(' ')

        const hostHtml = m.host ? `<span class="tc-party-panel-host-badge">Host</span>` : ''
        const roleHtml = m.role ? `<span class="tc-party-panel-role">${esc(m.role)}</span>` : ''
        const readyHtml = m.ready
            ? `<span class="tc-party-panel-ready-badge tc-party-panel-ready-badge--ready">Ready</span>`
            : `<span class="tc-party-panel-ready-badge tc-party-panel-ready-badge--waiting">Waiting</span>`

        return `<div class="${cls}" data-id="${esc(m.id)}">
            <span class="tc-party-panel-member-name">${esc(m.name)}</span>
            <span class="tc-party-panel-member-meta">${roleHtml}${hostHtml}</span>
            ${readyHtml}
        </div>`
    }

    private render(): void {
        const capacity = this.capacity
        const members = this._members.slice(0, capacity)
        const filled = members.length

        const slots = Array.from({ length: capacity }, (_, i) => this._renderSlot(i, members)).join(
            '',
        )

        patchHtml(
            this,
            `
            <div class="tc-party-panel">
                <div class="tc-party-panel-header">
                    <span class="tc-party-panel-eyebrow">Party</span>
                    <span class="tc-party-panel-count">${filled}/${capacity}</span>
                </div>
                <div class="tc-party-panel-slots">${slots}</div>
                <div class="tc-party-panel-actions">
                    <button type="button" class="tc-party-panel-btn tc-party-panel-btn--leave" data-action="leave">Leave Party</button>
                </div>
            </div>
        `,
        )

        const actions = this.querySelector<HTMLElement>('.tc-party-panel-actions')
        const slots_el = this.querySelector<HTMLElement>('.tc-party-panel-slots')

        bindOnce(slots_el, 'click', (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
                '[data-action="invite"]',
            )
            if (!btn || btn.disabled) return
            this._emit('tc-invite')
        })

        bindOnce(actions, 'click', (e: MouseEvent) => {
            const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')
            if (!btn || btn.disabled) return
            if (btn.dataset.action === 'leave') this._emit('tc-leave')
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: PartyPanel
    }
}
