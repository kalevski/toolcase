import { esc } from './internal/esc'

const TAG_NAME = 'tc-team-list'

export interface TeamMember {
    id: string
    name: string
    email?: string
    role?: string
    initials?: string
    avatarUrl?: string
    gradient?: boolean
}

// Derive avatar initials from a display name: first letter of a single-word name,
// first letters of the first two words otherwise, uppercased; '?' for blanks.
function deriveInitials(name: string): string {
    const words = String(name ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0].charAt(0).toUpperCase()
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

// Presentational list of team members — gradient avatar tiles, names, optional
// emails, and optional role chips. Content is driven exclusively by the `members`
// JS property (arrays can't be passed as HTML attributes); no events, no slots.
export class TeamList extends HTMLElement {
    private _initialised = false
    private _members: TeamMember[] = []

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get members(): TeamMember[] {
        return this._members
    }
    set members(v: TeamMember[]) {
        this._members = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _renderMember(member: TeamMember): string {
        const name = esc(member.name ?? '')

        let avatar: string
        if (member.avatarUrl) {
            avatar = `<img class="tc-team-list-avatar tc-team-list-avatar--img" src="${esc(member.avatarUrl)}" alt="${name}">`
        } else {
            const initials = esc(member.initials ? member.initials : deriveInitials(member.name ?? ''))
            const gradientClass = member.gradient !== false ? ' tc-team-list-avatar--gradient' : ''
            avatar = `<span class="tc-team-list-avatar${gradientClass}" aria-hidden="true">${initials}</span>`
        }

        const emailHtml = member.email
            ? `<span class="tc-team-list-email">${esc(member.email)}</span>`
            : ''
        const roleHtml = member.role
            ? `<span class="tc-team-list-role">${esc(member.role)}</span>`
            : ''

        return (
            `<li class="tc-team-list-member" role="listitem">` +
            avatar +
            `<div class="tc-team-list-info">` +
            `<span class="tc-team-list-name">${name}</span>` +
            emailHtml +
            `</div>` +
            roleHtml +
            `</li>`
        )
    }

    private render(): void {
        const items = this._members.map((m) => this._renderMember(m)).join('')
        this.innerHTML = `<ul class="tc-team-list" role="list">${items}</ul>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TeamList
    }
}
