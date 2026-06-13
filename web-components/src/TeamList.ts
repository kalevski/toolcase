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

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function deriveInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) return '?'
    if (words.length === 1) return words[0][0].toUpperCase()
    return (words[0][0] + words[1][0]).toUpperCase()
}

export class TeamList extends HTMLElement {
    private _initialised = false
    private _members: TeamMember[] = []

    static get observedAttributes(): string[] {
        return []
    }

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
        const initials = member.initials
            ? esc(member.initials)
            : esc(deriveInitials(member.name))

        let avatarHtml: string
        if (member.avatarUrl) {
            avatarHtml = `<img class="tc-team-list-avatar tc-team-list-avatar--img" src="${esc(member.avatarUrl)}" alt="${esc(member.name)}" />`
        } else {
            const gradientClass = member.gradient !== false ? ' tc-team-list-avatar--gradient' : ''
            avatarHtml = `<span class="tc-team-list-avatar${gradientClass}" aria-hidden="true">${initials}</span>`
        }

        const emailHtml = member.email
            ? `<span class="tc-team-list-email">${esc(member.email)}</span>`
            : ''

        const roleHtml = member.role
            ? `<span class="tc-team-list-role">${esc(member.role)}</span>`
            : ''

        return [
            `<li class="tc-team-list-member" role="listitem">`,
            avatarHtml,
            `<div class="tc-team-list-info">`,
            `<span class="tc-team-list-name">${esc(member.name)}</span>`,
            emailHtml,
            `</div>`,
            roleHtml,
            `</li>`,
        ].join('')
    }

    private render(): void {
        const items = this._members.map(m => this._renderMember(m)).join('')
        this.innerHTML = `<ul class="tc-team-list" role="list">${items}</ul>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: TeamList
    }
}
