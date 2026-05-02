const TAG_NAME = 'gc-guild-panel'

export interface GuildMember {
    id: string
    name: string
    rank?: string
    online?: boolean
    contribution?: number
}

export class GuildPanel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['guild-name', 'tag', 'motto', 'level', 'member-cap']
    }

    private _members: GuildMember[] = []

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

    private numberAttr(name: string, fallback: number | null): number | null {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    get guildName(): string { return this.getAttribute('guild-name') ?? '' }
    set guildName(v: string) {
        if (v) this.setAttribute('guild-name', v)
        else this.removeAttribute('guild-name')
    }

    get tag(): string { return this.getAttribute('tag') ?? '' }
    set tag(v: string) {
        if (v) this.setAttribute('tag', v)
        else this.removeAttribute('tag')
    }

    get motto(): string { return this.getAttribute('motto') ?? '' }
    set motto(v: string) {
        if (v) this.setAttribute('motto', v)
        else this.removeAttribute('motto')
    }

    get level(): number | null { return this.numberAttr('level', null) }
    set level(v: number | null) {
        if (v == null) this.removeAttribute('level')
        else this.setAttribute('level', String(v))
    }

    get memberCap(): number | null { return this.numberAttr('member-cap', null) }
    set memberCap(v: number | null) {
        if (v == null) this.removeAttribute('member-cap')
        else this.setAttribute('member-cap', String(v))
    }

    get members(): GuildMember[] {
        return this._members.slice()
    }
    set members(value: GuildMember[]) {
        this._members = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
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
        const memberCap = this.memberCap
        const memberCount = this._members.length
        const onlineCount = this._members.filter((m) => m.online).length

        const tagMarkup = this.tag
            ? `<span class="gc-guild-panel-tag">[${this.escape(this.tag)}]</span>`
            : ''
        const mottoMarkup = this.motto
            ? `<p class="gc-guild-panel-motto">"${this.escape(this.motto)}"</p>`
            : ''
        const levelMarkup = this.level != null
            ? `<div class="gc-guild-panel-stat"><gc-eyebrow>Level</gc-eyebrow><span class="gc-guild-panel-stat-value">${this.level}</span></div>`
            : ''

        const membersMarkup = this._members.map((m) => {
            const cls = `gc-guild-panel-member${m.online ? ' is-online' : ' is-offline'}`
            const rankMarkup = m.rank
                ? `<span class="gc-guild-panel-member-rank">${this.escape(m.rank)}</span>`
                : ''
            const contribMarkup = typeof m.contribution === 'number'
                ? `<span class="gc-guild-panel-member-contribution">${m.contribution.toLocaleString()}</span>`
                : ''
            return `<div class="${cls}" data-id="${this.escape(m.id)}">
                <span class="gc-guild-panel-member-pip"></span>
                <span class="gc-guild-panel-member-name">${this.escape(m.name)}</span>
                ${rankMarkup}
                ${contribMarkup}
            </div>`
        }).join('')

        const headcountText = memberCap != null ? `${memberCount}/${memberCap}` : `${memberCount}`

        this.innerHTML = `
            <div class="gc-guild-panel-header">
                <gc-eyebrow class="gc-guild-panel-eyebrow">Guild</gc-eyebrow>
                <gc-title class="gc-guild-panel-name">${this.escape(this.guildName)} ${tagMarkup}</gc-title>
                ${mottoMarkup}
            </div>
            <div class="gc-guild-panel-stats">
                ${levelMarkup}
                <div class="gc-guild-panel-stat"><gc-eyebrow>Members</gc-eyebrow><span class="gc-guild-panel-stat-value">${headcountText}</span></div>
                <div class="gc-guild-panel-stat"><gc-eyebrow>Online</gc-eyebrow><span class="gc-guild-panel-stat-value">${onlineCount}</span></div>
            </div>
            <gc-eyebrow class="gc-guild-panel-eyebrow">Roster</gc-eyebrow>
            <div class="gc-guild-panel-members">${membersMarkup}</div>
        `
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GuildPanel
    }
}
