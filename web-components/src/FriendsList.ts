import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-friends-list'

export type FriendStatus = 'online' | 'away' | 'busy' | 'offline' | 'in-game'

const STATUSES: FriendStatus[] = ['online', 'away', 'busy', 'offline', 'in-game']

export interface Friend {
    id: string
    name: string
    status?: FriendStatus
    activity?: string
    rank?: string
}

export interface FriendsListEventMap {
    'tc-invite': CustomEvent<{ id: string }>
    'tc-message': CustomEvent<{ id: string }>
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

// Action glyphs (resolved once) — lucide inline SVG, never unicode/emoji. The
// game-components original used ✉ / ＋ unicode glyphs; the toolcase design
// system mandates inline SVG so the icon recolors from CSS `color`.
const messageIconHtml = lucideByName('message-square')
const inviteIconHtml = lucideByName('user-plus')

const STATUS_LABELS: Record<FriendStatus, string> = {
    'in-game': 'In game',
    online: 'Online',
    busy: 'Busy',
    away: 'Away',
    offline: 'Offline',
}

function statusOrder(status?: FriendStatus): number {
    switch (status) {
        case 'in-game':
            return 0
        case 'online':
            return 1
        case 'busy':
            return 2
        case 'away':
            return 3
        case 'offline':
            return 4
        default:
            return 5
    }
}

export class FriendsList extends HTMLElement {

    private _initialised = false
    private _friends: Friend[] = []

    // Optional callback properties — fired alongside the tc-* CustomEvents.
    onInvite: ((detail: { id: string }) => void) | null = null
    onMessage: ((detail: { id: string }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['list-title']
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

    get listTitle(): string {
        return this.getAttribute('list-title') ?? 'Friends'
    }
    set listTitle(v: string) {
        if (v) this.setAttribute('list-title', v)
        else this.removeAttribute('list-title')
    }

    get friends(): Friend[] {
        return this._friends.slice()
    }
    set friends(value: Friend[]) {
        this._friends = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private _emit(name: 'tc-invite' | 'tc-message', id: string): void {
        const detail = { id }
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
        if (name === 'tc-invite' && typeof this.onInvite === 'function') this.onInvite(detail)
        else if (name === 'tc-message' && typeof this.onMessage === 'function') this.onMessage(detail)
    }

    private _renderRow(f: Friend): string {
        const status: FriendStatus = STATUSES.includes(f.status as FriendStatus)
            ? (f.status as FriendStatus)
            : 'offline'
        const cls = `tc-friends-list-row tc-friends-list-row--${status}`

        // Explicit activity wins; otherwise show "Offline" only for offline friends.
        const activity = f.activity
            ? esc(f.activity)
            : status === 'offline'
                ? 'Offline'
                : ''
        const activityHtml = activity
            ? `<span class="tc-friends-list-activity">${activity}</span>`
            : ''

        const rankHtml = f.rank
            ? `<span class="tc-friends-list-rank">${esc(f.rank)}</span>`
            : ''

        const name = esc(f.name)
        const statusLabel = esc(STATUS_LABELS[status])

        return [
            `<li role="listitem" class="${cls}" data-id="${esc(f.id)}">`,
            `<span class="tc-friends-list-pip" role="img" aria-label="${statusLabel}" title="${statusLabel}"></span>`,
            `<div class="tc-friends-list-text">`,
            `<span class="tc-friends-list-name">${name}</span>`,
            activityHtml,
            `</div>`,
            rankHtml,
            `<div class="tc-friends-list-actions">`,
            `<button type="button" class="tc-friends-list-action" data-action="message" aria-label="Message ${name}">${messageIconHtml}</button>`,
            `<button type="button" class="tc-friends-list-action" data-action="invite" aria-label="Invite ${name}">${inviteIconHtml}</button>`,
            `</div>`,
            `</li>`,
        ].join('')
    }

    private render(): void {
        const sorted = this._friends.slice().sort((a, b) => {
            const oa = statusOrder(a.status)
            const ob = statusOrder(b.status)
            if (oa !== ob) return oa - ob
            return a.name.localeCompare(b.name)
        })

        const onlineCount = this._friends.filter(f => f.status && f.status !== 'offline').length
        const total = this._friends.length

        const rows = sorted.map(f => this._renderRow(f)).join('')

        this.innerHTML = [
            `<div class="tc-friends-list">`,
            `<div class="tc-friends-list-header">`,
            `<span class="tc-friends-list-title">${esc(this.listTitle)}</span>`,
            `<span class="tc-friends-list-count">${onlineCount}/${total}</span>`,
            `</div>`,
            `<ul class="tc-friends-list-body" role="list">${rows}</ul>`,
            `</div>`,
        ].join('')

        // Delegate clicks on the freshly-rendered body — the old container and its
        // listener are garbage-collected together on every render, so no leak.
        const body = this.querySelector<HTMLElement>('.tc-friends-list-body')
        body?.addEventListener('click', (event: MouseEvent) => {
            const btn = (event.target as HTMLElement).closest<HTMLButtonElement>('.tc-friends-list-action')
            if (!btn) return
            event.stopPropagation()
            const row = btn.closest<HTMLElement>('.tc-friends-list-row')
            const id = row?.dataset.id ?? ''
            const action = btn.dataset.action
            if (action === 'invite') this._emit('tc-invite', id)
            else if (action === 'message') this._emit('tc-message', id)
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FriendsList
    }
}
