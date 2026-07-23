import { esc } from './internal/esc'

const TAG_NAME = 'tc-module-access'

export interface ModuleAccessRole {
    id: string
    name: string
    /** Built-in roles get a lock note in the read-only head. */
    builtin?: boolean
    /** Full permission keys granted to this role, e.g. `"project.create"`. */
    permissions: string[]
    /** Quota values keyed by `ModuleAccessLimitableResource.key`. */
    limits?: Record<string, number>
}

export interface ModuleAccessLimitableResource {
    key: string
    label: string
}

/** Current editable state of `role`, read straight from the live DOM. */
export interface ModuleAccessRoleDraft {
    id: string
    name: string
    permissions: string[]
    limits: Record<string, number>
}

/**
 * tc-module-access — a single role's permission editor: name, quota limits,
 * and the permission catalog grouped by domain prefix into toggle-chip cards.
 * No role picker, no bindings, no explicit save — every edit is live and
 * immediately reflected in a `tc-change` event carrying the full draft, so
 * the host owns persistence and any surrounding navigation entirely.
 */
export class ModuleAccess extends HTMLElement {
    private _initialised = false

    private _role: ModuleAccessRole | null = null
    private _permissions: string[] = []
    private _limitableResources: ModuleAccessLimitableResource[] = []
    private _permissionGroupLabels: Record<string, string> = {}

    onChange: ((draft: ModuleAccessRoleDraft) => void) | null = null

    static get observedAttributes(): string[] {
        return ['owner-role-id']
    }

    connectedCallback(): void {
        this.addEventListener('click', this._onClick)
        this.addEventListener('input', this._onInput)
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('input', this._onInput)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get ownerRoleId(): string {
        return this.getAttribute('owner-role-id') ?? 'owner'
    }
    set ownerRoleId(v: string) {
        this.setAttribute('owner-role-id', v)
    }

    get roleData(): ModuleAccessRole | null {
        return this._role
    }
    set roleData(v: ModuleAccessRole | null) {
        this._role = v ?? null
        if (this._initialised) this.render()
    }

    get permissions(): string[] {
        return this._permissions
    }
    set permissions(v: string[]) {
        this._permissions = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get limitableResources(): ModuleAccessLimitableResource[] {
        return this._limitableResources
    }
    set limitableResources(v: ModuleAccessLimitableResource[]) {
        this._limitableResources = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    /** Optional override for a permission domain's display label (defaults to the capitalised prefix). */
    get permissionGroupLabels(): Record<string, string> {
        return this._permissionGroupLabels
    }
    set permissionGroupLabels(v: Record<string, string>) {
        this._permissionGroupLabels = v && typeof v === 'object' ? v : {}
        if (this._initialised) this.render()
    }

    // ── Derived data ─────────────────────────────────────────────────────────

    private _groupOf(key: string): string {
        const dot = key.indexOf('.')
        return dot === -1 ? key : key.slice(0, dot)
    }

    private _groupLabel(group: string): string {
        return this._permissionGroupLabels[group] ?? group.charAt(0).toUpperCase() + group.slice(1)
    }

    private _permissionGroups(): { group: string; keys: string[] }[] {
        const order: string[] = []
        const byGroup = new Map<string, string[]>()
        for (const key of this._permissions) {
            const g = this._groupOf(key)
            if (!byGroup.has(g)) {
                byGroup.set(g, [])
                order.push(g)
            }
            byGroup.get(g)!.push(key)
        }
        return order.map((group) => ({ group, keys: byGroup.get(group)! }))
    }

    // ── Draft (read straight from the live DOM) ─────────────────────────────

    private _readDraft(): ModuleAccessRoleDraft | null {
        if (!this._role) return null

        const nameInput = this.querySelector<HTMLInputElement>(
            '.module-access__head input[data-role-name]',
        )
        const name = nameInput?.value.trim() ?? this._role.name

        const limits: Record<string, number> = {}
        this.querySelectorAll<HTMLInputElement>(
            '.module-access__limits input[data-limit-key]',
        ).forEach((el) => {
            const key = el.dataset.limitKey!
            const n = Number(el.value)
            limits[key] = Number.isFinite(n) ? n : 0
        })

        const permissions: string[] = []
        this.querySelectorAll<HTMLElement>(
            '.module-access__groups tc-chip[data-perm-key][selected]',
        ).forEach((el) => {
            permissions.push(el.dataset.permKey!)
        })

        return { id: this._role.id, name, permissions, limits }
    }

    private _emitChange(): void {
        const draft = this._readDraft()
        if (!draft) return
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { role: draft },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(draft)
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private _onClick = (e: Event): void => {
        const target = e.target as HTMLElement

        const chip = target.closest<HTMLElement>('.module-access__groups tc-chip[data-perm-key]')
        if (chip) {
            if (chip.hasAttribute('selected')) chip.removeAttribute('selected')
            else chip.setAttribute('selected', '')
            this._syncGroupCount(chip.closest<HTMLElement>('.module-access__group')!)
            this._emitChange()
            return
        }

        const bulk = target.closest<HTMLElement>('.module-access__group-bulk')
        if (bulk) {
            const groupEl = bulk.closest<HTMLElement>('.module-access__group')!
            const chips = Array.from(
                groupEl.querySelectorAll<HTMLElement>('tc-chip[data-perm-key]'),
            )
            const allOn = chips.every((c) => c.hasAttribute('selected'))
            chips.forEach((c) => {
                if (allOn) c.removeAttribute('selected')
                else c.setAttribute('selected', '')
            })
            this._syncGroupCount(groupEl)
            this._emitChange()
        }
    }

    private _onInput = (e: Event): void => {
        const target = e.target as HTMLElement
        if (
            target.matches('.module-access__head input[data-role-name]') ||
            target.matches('.module-access__limits input[data-limit-key]')
        ) {
            this._emitChange()
        }
    }

    private _syncGroupCount(groupEl: HTMLElement): void {
        const chips = Array.from(groupEl.querySelectorAll<HTMLElement>('tc-chip[data-perm-key]'))
        const on = chips.filter((c) => c.hasAttribute('selected')).length
        const countEl = groupEl.querySelector('.module-access__group-count')
        if (countEl) countEl.textContent = `${on}/${chips.length}`
        const bulkEl = groupEl.querySelector('.module-access__group-bulk')
        if (bulkEl) bulkEl.textContent = on === chips.length ? 'None' : 'All'
    }

    // ── Render ───────────────────────────────────────────────────────────────

    private _renderGroups(selected: Set<string>): string {
        const groups = this._permissionGroups()

        const html = groups
            .map(({ group, keys }) => {
                const on = keys.filter((k) => selected.has(k)).length
                const chips = keys
                    .map((k) => {
                        const label = k.slice(group.length + 1) || k
                        const isSelected = selected.has(k) ? ' selected' : ''
                        return `<tc-chip class="module-access__perm-chip" data-perm-key="${esc(k)}"${isSelected}>${esc(label)}</tc-chip>`
                    })
                    .join('')

                return (
                    `<div class="module-access__group">` +
                    `<div class="module-access__group-head">` +
                    `<span class="module-access__group-title">${esc(this._groupLabel(group))}</span>` +
                    `<span class="module-access__group-count">${on}/${keys.length}</span>` +
                    `<button type="button" class="module-access__group-bulk">${on === keys.length ? 'None' : 'All'}</button>` +
                    `</div>` +
                    `<div class="module-access__group-chips">${chips}</div>` +
                    `</div>`
                )
            })
            .join('')

        return (
            html ||
            `<tc-empty-state icon="shield" heading="No permissions configured"></tc-empty-state>`
        )
    }

    private render(): void {
        if (!this._role) {
            this.innerHTML = `<div class="module-access"><tc-empty-state icon="shield" heading="No role selected" description="Pick a role to view or edit its access."></tc-empty-state></div>`
            return
        }

        const role = this._role
        const isOwner = role.id === this.ownerRoleId

        if (isOwner) {
            this.innerHTML =
                `<div class="module-access module-access--readonly">` +
                `<div class="module-access__head"><h3 class="module-access__name">${esc(role.name)}</h3>` +
                `<code class="module-access__id">${esc(role.id)}</code></div>` +
                `<p class="module-access__owner-note">The owner role always holds every permission — there's nothing a form could change.</p>` +
                `</div>`
            return
        }

        const limits = role.limits ?? {}

        const limitsHtml =
            this._limitableResources.length === 0
                ? ''
                : `<div class="module-access__limits">` +
                  this._limitableResources
                      .map(
                          (res) =>
                              `<label class="module-access__limit">` +
                              `<span class="module-access__limit-label">${esc(res.label)}</span>` +
                              `<input type="number" min="0" class="form-control form-control-sm" data-limit-key="${esc(res.key)}" value="${esc(String(limits[res.key] ?? 0))}">` +
                              `</label>`,
                      )
                      .join('') +
                  `</div>`

        this.innerHTML =
            `<div class="module-access">` +
            `<div class="module-access__head">` +
            `<input type="text" class="form-control" data-role-name value="${esc(role.name)}" placeholder="Role name" aria-label="Role name">` +
            `<code class="module-access__id">${esc(role.id)}</code>` +
            `</div>` +
            limitsHtml +
            `<div class="module-access__groups">${this._renderGroups(new Set(role.permissions))}</div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ModuleAccess
    }
}
