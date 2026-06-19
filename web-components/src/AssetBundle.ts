import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon, chevronDownIcon } from './icons'
import { ActionItem } from './ActionItems'

const TAG_NAME = 'tc-asset-bundle'

/** Free-form advanced packing options. Keys are rendered generically:
 *  booleans → on/off pill, numbers → mono figure, strings → mono text. */
export interface AssetBundleAdvancedOptions {
    compress?: boolean
    powerOfTwo?: boolean
    trim?: boolean
    padding?: number
    scale?: number
    rotationEnabled?: boolean
    algorithm?: string
    [key: string]: boolean | number | string | undefined
}

let _idCounter = 0

function lucideHtml(name: string, className?: string): string {
    if (!name) return ''
    // Accept PascalCase directly, or kebab-case (convert to PascalCase).
    const pascal = name.includes('-')
        ? name.replace(/(^\w|-\w)/g, (m) => m.replace('-', '').toUpperCase())
        : name
    const svgStr =
        (LucideIcons as Record<string, string>)[pascal] ??
        (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr, className)
}

/** camelCase / snake_case key → human label ("powerOfTwo" → "Power Of Two"). */
function humanizeKey(key: string): string {
    return key
        .replace(/[_-]+/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (c) => c.toUpperCase())
}

// Resolved once at module load — these icons are always rendered.
const plusIconHtml = lucideHtml('Plus', 'tc-asset-bundle-tag-icon')
const minusIconHtml = lucideHtml('Minus', 'tc-asset-bundle-tag-icon')
const filesIconHtml = lucideHtml('Files', 'tc-asset-bundle-section-icon')
const tagsIconHtml = lucideHtml('Tags', 'tc-asset-bundle-section-icon')
const gitBranchIconHtml = lucideHtml('GitBranch', 'tc-asset-bundle-section-icon')
const slidersIconHtml = lucideHtml('SlidersHorizontal', 'tc-asset-bundle-section-icon')
const checkIconHtml = lucideHtml('Check', 'tc-asset-bundle-opt-icon')
const xIconHtml = lucideHtml('X', 'tc-asset-bundle-opt-icon')
const moreVerticalIconHtml = lucideHtml('MoreVertical', 'tc-asset-bundle-menu-icon')

export class AssetBundle extends HTMLElement {
    private _initialised = false
    private _includedTags: string[] = []
    private _excludedTags: string[] = []
    private _counts: Record<string, number> = {}
    private _advanced: AssetBundleAdvancedOptions = {}
    private _menuItems: ActionItem[] = []
    private _advancedOpen = false
    private _isMenuOpen = false
    private _suppressRender = false
    private _outsideHandler: ((e: MouseEvent) => void) | null = null
    private readonly _panelId = `tc-asset-bundle-adv-${++_idCounter}`

    onMenuItemClick: ((key: string) => void) | null = null
    onAdvancedToggle: ((open: boolean) => void) | null = null
    onBuildTagChange: ((tag: string) => void) | null = null

    static get observedAttributes(): string[] {
        return [
            'name',
            'target',
            'target-icon',
            'category',
            'latest-build-ref',
            'default-build-tag',
            'build-tag',
            'loading',
        ]
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._bindListeners()
            this._initialised = true
        }
    }

    disconnectedCallback(): void {
        this._removeOutsideListener()
        this._isMenuOpen = false
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised || this._suppressRender) return
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
        this._bindListeners()
    }

    // ── Attribute getters / setters ───────────────────────────────────────────

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get target(): string | null {
        return this.getAttribute('target')
    }
    set target(v: string | null) {
        if (v != null) this.setAttribute('target', v)
        else this.removeAttribute('target')
    }

    get targetIcon(): string | null {
        return this.getAttribute('target-icon')
    }
    set targetIcon(v: string | null) {
        if (v != null) this.setAttribute('target-icon', v)
        else this.removeAttribute('target-icon')
    }

    get category(): string | null {
        return this.getAttribute('category')
    }
    set category(v: string | null) {
        if (v != null) this.setAttribute('category', v)
        else this.removeAttribute('category')
    }

    get latestBuildRef(): string | null {
        return this.getAttribute('latest-build-ref')
    }
    set latestBuildRef(v: string | null) {
        if (v != null) this.setAttribute('latest-build-ref', v)
        else this.removeAttribute('latest-build-ref')
    }

    get defaultBuildTag(): string | null {
        return this.getAttribute('default-build-tag')
    }
    set defaultBuildTag(v: string | null) {
        if (v != null) this.setAttribute('default-build-tag', v)
        else this.removeAttribute('default-build-tag')
    }

    get buildTag(): string | null {
        return this.getAttribute('build-tag')
    }
    set buildTag(v: string | null) {
        if (v != null) this.setAttribute('build-tag', v)
        else this.removeAttribute('build-tag')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS-property getters / setters ─────────────────────────────────────────

    get includedTags(): string[] {
        return this._includedTags
    }
    set includedTags(v: string[]) {
        this._includedTags = Array.isArray(v) ? v.map(String) : []
        this._rerender()
    }

    get excludedTags(): string[] {
        return this._excludedTags
    }
    set excludedTags(v: string[]) {
        this._excludedTags = Array.isArray(v) ? v.map(String) : []
        this._rerender()
    }

    get counts(): Record<string, number> {
        return this._counts
    }
    set counts(v: Record<string, number>) {
        this._counts = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        this._rerender()
    }

    get advanced(): AssetBundleAdvancedOptions {
        return this._advanced
    }
    set advanced(v: AssetBundleAdvancedOptions) {
        this._advanced = v && typeof v === 'object' && !Array.isArray(v) ? v : {}
        this._rerender()
    }

    get menuItems(): ActionItem[] {
        return this._menuItems
    }
    set menuItems(v: ActionItem[]) {
        this._menuItems = Array.isArray(v) ? v : []
        this._rerender()
    }

    private _rerender(): void {
        if (!this._initialised) return
        if (this._isMenuOpen) this._closeMenu(false)
        this.render()
        this._bindListeners()
    }

    // ── Build-tag helpers ─────────────────────────────────────────────────────

    private _buildTagCandidates(): string[] {
        const out: string[] = []
        const def = this.defaultBuildTag
        const cur = this.buildTag
        if (def) out.push(def)
        if (cur && !out.includes(cur)) out.push(cur)
        return out
    }

    private _activeBuildTag(): string | null {
        return this.buildTag ?? this.defaultBuildTag
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private render(): void {
        if (this.loading) {
            this.setAttribute('aria-busy', 'true')
            this.innerHTML = [
                '<div class="tc-asset-bundle card tc-asset-bundle--loading" aria-hidden="true">',
                '<div class="tc-asset-bundle-header card-header">',
                '<div class="tc-asset-bundle-skeleton tc-asset-bundle-skeleton--name"></div>',
                '<div class="tc-asset-bundle-skeleton tc-asset-bundle-skeleton--target"></div>',
                '</div>',
                '<div class="tc-asset-bundle-body card-body">',
                '<div class="tc-asset-bundle-skeleton tc-asset-bundle-skeleton--bar"></div>',
                '<div class="tc-asset-bundle-skeleton tc-asset-bundle-skeleton--bar"></div>',
                '<div class="tc-asset-bundle-skeleton tc-asset-bundle-skeleton--bar tc-asset-bundle-skeleton--short"></div>',
                '</div>',
                '</div>',
                '<span class="visually-hidden" role="status">Loading…</span>',
            ].join('')
            return
        }

        this.removeAttribute('aria-busy')

        const name = this.name ?? ''
        const target = this.target ?? ''
        const targetIconName = this.targetIcon || 'Package'
        const category = this.category
        const latestBuildRef = this.latestBuildRef
        const hasMenu = this._menuItems.length > 0

        const targetIconHtml = lucideHtml(targetIconName, 'tc-asset-bundle-target-icon')

        // Header
        const menuHtml = hasMenu
            ? [
                  '<div class="tc-asset-bundle-menu-wrapper">',
                  '<button class="tc-asset-bundle-menu-trigger" type="button" aria-haspopup="menu" aria-expanded="false">',
                  '<span class="visually-hidden">Actions</span>',
                  moreVerticalIconHtml,
                  '</button>',
                  '<div class="tc-asset-bundle-menu" role="menu" aria-label="Bundle actions">',
                  this._renderMenuItems(),
                  '</div>',
                  '</div>',
              ].join('')
            : ''

        const categoryHtml = category
            ? `<span class="tc-asset-bundle-category badge">${esc(category)}</span>`
            : ''

        const headerHtml = [
            '<div class="tc-asset-bundle-header card-header">',
            '<div class="tc-asset-bundle-heading">',
            name ? `<span class="tc-asset-bundle-name">${esc(name)}</span>` : '',
            '<div class="tc-asset-bundle-target">',
            targetIconHtml,
            target ? `<span class="tc-asset-bundle-target-name">${esc(target)}</span>` : '',
            categoryHtml,
            '</div>',
            '</div>',
            menuHtml,
            '</div>',
        ].join('')

        // Tags section
        const includedHtml = this._includedTags
            .map(
                (t) =>
                    `<span class="tc-asset-bundle-tag tc-asset-bundle-tag--included">${plusIconHtml}<span>${esc(t)}</span></span>`,
            )
            .join('')
        const excludedHtml = this._excludedTags
            .map(
                (t) =>
                    `<span class="tc-asset-bundle-tag tc-asset-bundle-tag--excluded">${minusIconHtml}<span>${esc(t)}</span></span>`,
            )
            .join('')

        const tagsHtml =
            this._includedTags.length > 0 || this._excludedTags.length > 0
                ? [
                      '<div class="tc-asset-bundle-section tc-asset-bundle-tags-section">',
                      '<span class="tc-asset-bundle-section-title">',
                      tagsIconHtml,
                      '<span>Tags</span>',
                      '</span>',
                      '<div class="tc-asset-bundle-tag-list">',
                      includedHtml,
                      excludedHtml,
                      '</div>',
                      '</div>',
                  ].join('')
                : ''

        // Counts stat row
        const countEntries = Object.entries(this._counts)
        const countsHtml =
            countEntries.length > 0
                ? [
                      '<div class="tc-asset-bundle-section tc-asset-bundle-counts-section">',
                      '<span class="tc-asset-bundle-section-title">',
                      filesIconHtml,
                      '<span>Files</span>',
                      '</span>',
                      '<div class="tc-asset-bundle-counts">',
                      countEntries
                          .map(
                              ([type, count]) =>
                                  `<span class="tc-asset-bundle-count"><span class="tc-asset-bundle-count-label">${esc(type)}</span><span class="tc-asset-bundle-count-value">${esc(String(count))}</span></span>`,
                          )
                          .join(''),
                      '</div>',
                      '</div>',
                  ].join('')
                : ''

        // Build references
        const candidates = this._buildTagCandidates()
        const active = this._activeBuildTag()
        const interactive = candidates.length > 1
        let buildTagHtml = ''
        if (candidates.length > 0) {
            if (interactive) {
                buildTagHtml = `<div class="tc-asset-bundle-build-tags" role="radiogroup" aria-label="Build tag">${candidates
                    .map((t) => {
                        const isActive = t === active
                        return `<button class="tc-asset-bundle-build-tag${isActive ? ' tc-asset-bundle-build-tag--active' : ''}" type="button" role="radio" aria-checked="${isActive}" data-tag="${esc(t)}">${esc(t)}</button>`
                    })
                    .join('')}</div>`
            } else {
                buildTagHtml = `<span class="tc-asset-bundle-build-tag tc-asset-bundle-build-tag--static">${esc(candidates[0])}</span>`
            }
        }
        const refHtml = latestBuildRef
            ? `<code class="tc-asset-bundle-build-ref">${esc(latestBuildRef)}</code>`
            : ''
        const buildsHtml =
            latestBuildRef || candidates.length > 0
                ? [
                      '<div class="tc-asset-bundle-section tc-asset-bundle-builds-section">',
                      '<span class="tc-asset-bundle-section-title">',
                      gitBranchIconHtml,
                      '<span>Build</span>',
                      '</span>',
                      '<div class="tc-asset-bundle-builds">',
                      refHtml,
                      buildTagHtml,
                      '</div>',
                      '</div>',
                  ].join('')
                : ''

        // Advanced (collapsible)
        const advEntries = Object.entries(this._advanced).filter(([, v]) => v !== undefined)
        let advancedHtml = ''
        if (advEntries.length > 0) {
            const optionsHtml = advEntries
                .map(([key, val]) => {
                    const label = `<span class="tc-asset-bundle-opt-label">${esc(humanizeKey(key))}</span>`
                    let valueHtml: string
                    if (typeof val === 'boolean') {
                        const cls = val
                            ? 'tc-asset-bundle-opt-bool--on'
                            : 'tc-asset-bundle-opt-bool--off'
                        valueHtml = `<span class="tc-asset-bundle-opt-bool ${cls}">${val ? checkIconHtml : xIconHtml}<span>${val ? 'On' : 'Off'}</span></span>`
                    } else {
                        valueHtml = `<span class="tc-asset-bundle-opt-value">${esc(String(val))}</span>`
                    }
                    return `<div class="tc-asset-bundle-opt">${label}${valueHtml}</div>`
                })
                .join('')
            const open = this._advancedOpen
            advancedHtml = [
                '<div class="tc-asset-bundle-advanced">',
                `<button class="tc-asset-bundle-advanced-toggle" type="button" aria-expanded="${open}" aria-controls="${this._panelId}">`,
                slidersIconHtml,
                '<span>Advanced</span>',
                `<span class="tc-asset-bundle-advanced-caret" aria-hidden="true">${chevronDownIcon}</span>`,
                '</button>',
                `<div class="tc-asset-bundle-advanced-panel${open ? ' show' : ''}" id="${this._panelId}"${open ? '' : ' hidden'}>`,
                optionsHtml,
                '</div>',
                '</div>',
            ].join('')
        }

        const bodyHtml = [
            '<div class="tc-asset-bundle-body card-body">',
            tagsHtml,
            countsHtml,
            buildsHtml,
            advancedHtml,
            '</div>',
        ].join('')

        const targetMod = target
            ? ` tc-asset-bundle--${esc(target.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}`
            : ''

        this.innerHTML = `<div class="tc-asset-bundle card${targetMod}">${headerHtml}${bodyHtml}</div>`
    }

    private _renderMenuItems(): string {
        return this._menuItems
            .map((item, idx) => {
                if (item.divider) {
                    return `<div class="tc-asset-bundle-menu-divider" role="separator"></div>`
                }
                const disabled = item.disabled === true
                const dangerCls = item.danger ? ' tc-asset-bundle-menu-item--danger' : ''
                const disabledAttr = disabled ? ' disabled aria-disabled="true"' : ''
                const iconHtml = item.icon
                    ? lucideHtml(item.icon, 'tc-asset-bundle-menu-item-icon')
                    : ''
                return (
                    `<button class="tc-asset-bundle-menu-item${dangerCls}" role="menuitem" ` +
                    `type="button" tabindex="-1" data-idx="${idx}"${disabledAttr}>` +
                    `${iconHtml}<span>${esc(item.label)}</span></button>`
                )
            })
            .join('')
    }

    // ── Listeners ─────────────────────────────────────────────────────────────

    private _bindListeners(): void {
        // Advanced toggle
        const toggle = this.querySelector<HTMLButtonElement>('.tc-asset-bundle-advanced-toggle')
        if (toggle) {
            toggle.addEventListener('click', () => this._toggleAdvanced())
        }

        // Interactive build-tag chips
        Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-asset-bundle-build-tag[data-tag]'),
        ).forEach((btn) => {
            btn.addEventListener('click', () => {
                const tag = btn.dataset.tag ?? ''
                if (tag && tag !== this._activeBuildTag()) this._setActiveBuildTag(tag)
            })
        })

        // Menu trigger
        const trigger = this._getTrigger()
        if (trigger) {
            trigger.addEventListener('click', (e: Event) => {
                e.stopPropagation()
                if (this._isMenuOpen) this._closeMenu()
                else this._openMenu()
            })
            trigger.addEventListener('keydown', (e: Event) =>
                this._onTriggerKeydown(e as KeyboardEvent),
            )
        }

        const menu = this._getMenu()
        if (menu) {
            menu.addEventListener('keydown', (e: Event) => this._onMenuKeydown(e as KeyboardEvent))
        }

        Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-asset-bundle-menu-item:not([disabled])'),
        ).forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length)
                    this._selectItem(this._menuItems[idx].key)
            })
        })
    }

    // ── Advanced toggle ───────────────────────────────────────────────────────

    private _toggleAdvanced(): void {
        this._advancedOpen = !this._advancedOpen
        const toggle = this.querySelector<HTMLButtonElement>('.tc-asset-bundle-advanced-toggle')
        const panel = this.querySelector<HTMLElement>('.tc-asset-bundle-advanced-panel')
        if (toggle) toggle.setAttribute('aria-expanded', String(this._advancedOpen))
        if (panel) {
            panel.classList.toggle('show', this._advancedOpen)
            if (this._advancedOpen) panel.removeAttribute('hidden')
            else panel.setAttribute('hidden', '')
        }
        this.dispatchEvent(
            new CustomEvent('tc-advanced-toggle', {
                bubbles: true,
                composed: true,
                detail: { open: this._advancedOpen },
            }),
        )
        if (typeof this.onAdvancedToggle === 'function') this.onAdvancedToggle(this._advancedOpen)
    }

    // ── Build tag ─────────────────────────────────────────────────────────────

    private _setActiveBuildTag(tag: string): void {
        // Patch in place — avoid a full re-render (which would close menus / lose state).
        this._suppressRender = true
        this.setAttribute('build-tag', tag)
        this._suppressRender = false

        const active = this._activeBuildTag()
        Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-asset-bundle-build-tag[data-tag]'),
        ).forEach((btn) => {
            const isActive = btn.dataset.tag === active
            btn.classList.toggle('tc-asset-bundle-build-tag--active', isActive)
            btn.setAttribute('aria-checked', String(isActive))
        })

        this.dispatchEvent(
            new CustomEvent('tc-build-tag-change', {
                bubbles: true,
                composed: true,
                detail: { tag },
            }),
        )
        if (typeof this.onBuildTagChange === 'function') this.onBuildTagChange(tag)
    }

    // ── Menu (mirrors tc-build) ───────────────────────────────────────────────

    private _getTrigger(): HTMLButtonElement | null {
        return this.querySelector('.tc-asset-bundle-menu-trigger')
    }

    private _getMenu(): HTMLElement | null {
        return this.querySelector('.tc-asset-bundle-menu')
    }

    private _getEnabledItems(): HTMLButtonElement[] {
        return Array.from(
            this.querySelectorAll<HTMLButtonElement>('.tc-asset-bundle-menu-item:not([disabled])'),
        )
    }

    private _openMenu(focusLast = false): void {
        this._isMenuOpen = true
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'true')
        if (menu) menu.classList.add('show')

        const enabled = this._getEnabledItems()
        if (enabled.length > 0) {
            const target = focusLast ? enabled[enabled.length - 1] : enabled[0]
            target.setAttribute('tabindex', '0')
            target.focus()
        }

        this._outsideHandler = (e: MouseEvent) => {
            if (!this.contains(e.target as Node)) this._closeMenu(false)
        }
        document.addEventListener('mousedown', this._outsideHandler)
    }

    private _closeMenu(refocus = true): void {
        if (!this._isMenuOpen) return
        this._isMenuOpen = false
        const trigger = this._getTrigger()
        const menu = this._getMenu()
        if (trigger) trigger.setAttribute('aria-expanded', 'false')
        if (menu) menu.classList.remove('show')
        this._getEnabledItems().forEach((btn) => btn.setAttribute('tabindex', '-1'))
        this._removeOutsideListener()
        if (refocus) trigger?.focus()
    }

    private _removeOutsideListener(): void {
        if (this._outsideHandler) {
            document.removeEventListener('mousedown', this._outsideHandler)
            this._outsideHandler = null
        }
    }

    private _selectItem(key: string): void {
        this.dispatchEvent(
            new CustomEvent('tc-menu-click', {
                bubbles: true,
                composed: true,
                detail: { key },
            }),
        )
        if (typeof this.onMenuItemClick === 'function') this.onMenuItemClick(key)
        this._closeMenu()
    }

    private _onTriggerKeydown(e: KeyboardEvent): void {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            if (!this._isMenuOpen) this._openMenu(true)
        }
    }

    private _onMenuKeydown(e: KeyboardEvent): void {
        const enabled = this._getEnabledItems()
        if (enabled.length === 0) return

        const focused = document.activeElement as HTMLButtonElement
        const currentIdx = enabled.indexOf(focused)

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            const next = enabled[(currentIdx + 1) % enabled.length]
            next.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            next.focus()
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            const prev = enabled[(currentIdx - 1 + enabled.length) % enabled.length]
            prev.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            prev.focus()
        } else if (e.key === 'Home') {
            e.preventDefault()
            enabled[0].setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            enabled[0].focus()
        } else if (e.key === 'End') {
            e.preventDefault()
            const last = enabled[enabled.length - 1]
            last.setAttribute('tabindex', '0')
            if (focused && currentIdx >= 0) focused.setAttribute('tabindex', '-1')
            last.focus()
        } else if (e.key === 'Escape') {
            e.preventDefault()
            this._closeMenu()
        } else if (e.key === 'Tab') {
            this._closeMenu(false)
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (
                focused &&
                focused.classList.contains('tc-asset-bundle-menu-item') &&
                !focused.disabled
            ) {
                e.preventDefault()
                const idx = parseInt(focused.dataset.idx ?? '-1', 10)
                if (idx >= 0 && idx < this._menuItems.length)
                    this._selectItem(this._menuItems[idx].key)
            }
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AssetBundle
    }
}
