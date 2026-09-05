import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-guild-panel'

export interface GuildMember {
    id: string
    name: string
    rank?: string
    online?: boolean
    contribution?: number
}

export class GuildPanel extends HTMLElement {
    private _initialised = false
    private _members: GuildMember[] = []

    static get observedAttributes(): string[] {
        return ['guild-name', 'tag', 'motto', 'level', 'member-cap']
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

    // ── Attribute helpers ────────────────────────────────────────────────────

    private _numberAttr(name: string, fallback: number | null): number | null {
        const raw = this.getAttribute(name)
        if (raw == null) return fallback
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : fallback
    }

    // ── Attribute getters/setters ─────────────────────────────────────────────

    get guildName(): string {
        return this.getAttribute('guild-name') ?? ''
    }
    set guildName(v: string) {
        if (v) this.setAttribute('guild-name', v)
        else this.removeAttribute('guild-name')
    }

    get tag(): string {
        return this.getAttribute('tag') ?? ''
    }
    set tag(v: string) {
        if (v) this.setAttribute('tag', v)
        else this.removeAttribute('tag')
    }

    get motto(): string {
        return this.getAttribute('motto') ?? ''
    }
    set motto(v: string) {
        if (v) this.setAttribute('motto', v)
        else this.removeAttribute('motto')
    }

    get level(): number | null {
        return this._numberAttr('level', null)
    }
    set level(v: number | null) {
        if (v == null) this.removeAttribute('level')
        else this.setAttribute('level', String(v))
    }

    get memberCap(): number | null {
        return this._numberAttr('member-cap', null)
    }
    set memberCap(v: number | null) {
        if (v == null) this.removeAttribute('member-cap')
        else this.setAttribute('member-cap', String(v))
    }

    // ── JS property getters/setters ───────────────────────────────────────────

    get members(): GuildMember[] {
        return this._members.slice()
    }
    set members(value: GuildMember[]) {
        this._members = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    // ── Render ─────────────────────────────────────────────────────────────────

    private render(): void {
        const memberCap = this.memberCap
        const memberCount = this._members.length
        const onlineCount = this._members.filter((m) => m.online).length
        const level = this.level

        const tagMarkup = this.tag
            ? `<span class="tc-guild-panel-tag">[${esc(this.tag)}]</span>`
            : ''
        const mottoMarkup = this.motto
            ? `<p class="tc-guild-panel-motto">&ldquo;${esc(this.motto)}&rdquo;</p>`
            : ''
        const levelStat =
            level != null
                ? `<div class="tc-guild-panel-stat">` +
                  `<span class="tc-guild-panel-stat-label">Level</span>` +
                  `<span class="tc-guild-panel-stat-value">${esc(String(level))}</span>` +
                  `</div>`
                : ''

        const headcountText = memberCap != null ? `${memberCount}/${memberCap}` : `${memberCount}`

        const membersMarkup =
            memberCount > 0
                ? this._members
                      .map((m) => {
                          const online = !!m.online
                          const cls = `tc-guild-panel-member ${online ? 'tc-guild-panel-member--online' : 'tc-guild-panel-member--offline'}`
                          const statusLabel = online ? 'Online' : 'Offline'
                          const rankMarkup = m.rank
                              ? `<span class="tc-guild-panel-member-rank">${esc(m.rank)}</span>`
                              : ''
                          const contribMarkup =
                              typeof m.contribution === 'number'
                                  ? `<span class="tc-guild-panel-member-contribution">${esc(m.contribution.toLocaleString())}</span>`
                                  : ''
                          return (
                              `<li class="${cls}" role="listitem" data-id="${esc(m.id)}">` +
                              `<span class="tc-guild-panel-member-pip" role="img" aria-label="${statusLabel}" title="${statusLabel}"></span>` +
                              `<span class="tc-guild-panel-member-name">${esc(m.name)}</span>` +
                              rankMarkup +
                              contribMarkup +
                              `</li>`
                          )
                      })
                      .join('')
                : `<li class="tc-guild-panel-empty">No members</li>`

        patchHtml(
            this,
            `<div class="tc-guild-panel">` +
                `<div class="tc-guild-panel-header">` +
                `<span class="tc-guild-panel-eyebrow">Guild</span>` +
                `<div class="tc-guild-panel-name">` +
                `<span class="tc-guild-panel-name-text">${esc(this.guildName)}</span>` +
                tagMarkup +
                `</div>` +
                mottoMarkup +
                `</div>` +
                `<div class="tc-guild-panel-stats">` +
                levelStat +
                `<div class="tc-guild-panel-stat">` +
                `<span class="tc-guild-panel-stat-label">Members</span>` +
                `<span class="tc-guild-panel-stat-value">${esc(headcountText)}</span>` +
                `</div>` +
                `<div class="tc-guild-panel-stat">` +
                `<span class="tc-guild-panel-stat-label">Online</span>` +
                `<span class="tc-guild-panel-stat-value">${esc(String(onlineCount))}</span>` +
                `</div>` +
                `</div>` +
                `<div class="tc-guild-panel-roster">` +
                `<span class="tc-guild-panel-eyebrow">Roster</span>` +
                `<ul class="tc-guild-panel-members" role="list">${membersMarkup}</ul>` +
                `</div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GuildPanel
    }
}
