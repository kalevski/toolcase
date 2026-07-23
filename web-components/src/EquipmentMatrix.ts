import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'
import { icon } from './icons'
import { ChevronDown } from 'lucide-static'
import { EQUIPMENT_FLAG_ICONS, EQUIPMENT_FLAG_SUFFIX, type EquipmentFlag } from './EquipmentTag'

const TAG_NAME = 'tc-equipment-matrix'

export interface EquipmentMatrixItem {
    label: string
    icon?: string
    flag?: EquipmentFlag
}

const chevronIconHtml = icon(ChevronDown, 'tc-equipment-matrix-chevron')

// Section order mirrors how a spec sheet reads: what the variant ships with,
// what can be added, then the bundled option packages.
const SECTIONS: { flag: EquipmentFlag; title: string }[] = [
    { flag: 'included', title: 'Standard equipment' },
    { flag: 'optional', title: 'Optional extras' },
    { flag: 'package', title: 'Packages' },
]

// tc-equipment-matrix — the full equipment sheet of one catalog variant (the
// `variant_equipment` link table): items grouped by their feature_flag into
// Standard equipment / Optional extras / Packages sections, each capped by a
// mono micro-header with an item count. Items are a JS property (arrays can't
// be attributes, same as tc-car-listing-card `specs`); items without a flag
// fall into the Standard section. `columns="list"` renders dense two-column
// checklist rows instead of chips (print-style spec pages); `collapsible`
// collapses every section beyond the first behind a chevron toggle.
export class EquipmentMatrix extends HTMLElement {
    private _initialised = false
    private _items: EquipmentMatrixItem[] = []

    static get observedAttributes(): string[] {
        return ['columns', 'collapsible']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get items(): EquipmentMatrixItem[] {
        return this._items
    }
    set items(v: EquipmentMatrixItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    get columns(): 'chips' | 'list' {
        return this.getAttribute('columns') === 'list' ? 'list' : 'chips'
    }
    set columns(v: 'chips' | 'list') {
        this.setAttribute('columns', v)
    }

    get collapsible(): boolean {
        return this.hasAttribute('collapsible')
    }
    set collapsible(v: boolean) {
        if (v) this.setAttribute('collapsible', '')
        else this.removeAttribute('collapsible')
    }

    // ── Handlers ─────────────────────────────────────────────────────────────

    private _onClick = (e: MouseEvent): void => {
        const toggle = (e.target as Element | null)?.closest<HTMLElement>('.tc-equipment-matrix-toggle')
        if (!toggle || !this.contains(toggle)) return
        const section = toggle.closest('.tc-equipment-matrix-section')
        const body = section?.querySelector<HTMLElement>('.tc-equipment-matrix-body')
        if (!section || !body) return
        const open = toggle.getAttribute('aria-expanded') === 'true'
        toggle.setAttribute('aria-expanded', String(!open))
        section.classList.toggle('tc-equipment-matrix-section--collapsed', open)
        body.hidden = open
    }

    // ── Rendering ────────────────────────────────────────────────────────────

    private _normalisedFlag(item: EquipmentMatrixItem): EquipmentFlag {
        const raw = (item.flag ?? '').toLowerCase()
        return raw === 'optional' || raw === 'package' ? raw : 'included'
    }

    private _chipsHtml(items: EquipmentMatrixItem[]): string {
        const chips = items
            .map(
                (item) =>
                    `<tc-equipment-tag label="${esc(item.label)}"` +
                    (item.icon ? ` icon="${esc(item.icon)}"` : '') +
                    (item.flag ? ` flag="${esc(this._normalisedFlag(item))}"` : '') +
                    `></tc-equipment-tag>`,
            )
            .join('')
        return `<div class="tc-equipment-matrix-chips">${chips}</div>`
    }

    private _listHtml(items: EquipmentMatrixItem[]): string {
        const rows = items
            .map((item) => {
                const flag = this._normalisedFlag(item)
                const iconHtml = lucideByName(item.icon ?? EQUIPMENT_FLAG_ICONS[flag], 'tc-equipment-matrix-row-icon-svg')
                const suffix = item.flag ? EQUIPMENT_FLAG_SUFFIX[flag] : undefined
                return (
                    `<li class="tc-equipment-matrix-row tc-equipment-matrix-row--${flag}">` +
                    `<span class="tc-equipment-matrix-row-icon" aria-hidden="true">${iconHtml}</span>` +
                    `<span class="tc-equipment-matrix-row-label">${esc(item.label)}</span>` +
                    (suffix ? `<span class="tc-equipment-matrix-row-suffix">${suffix}</span>` : '') +
                    `</li>`
                )
            })
            .join('')
        return `<ul class="tc-equipment-matrix-list">${rows}</ul>`
    }

    private render(): void {
        const columns = this.columns
        const collapsible = this.collapsible

        const sections = SECTIONS.map(({ flag, title }) => ({
            flag,
            title,
            items: this._items.filter((item) => this._normalisedFlag(item) === flag),
        })).filter((section) => section.items.length > 0)

        const html = sections
            .map((section, index) => {
                const collapsed = collapsible && index > 0
                const headerInner =
                    `<span class="tc-equipment-matrix-title">${esc(section.title)}</span>` +
                    `<span class="tc-equipment-matrix-count">${section.items.length}</span>`
                const headerHtml = collapsible
                    ? `<button type="button" class="tc-equipment-matrix-header tc-equipment-matrix-toggle" ` +
                      `aria-expanded="${!collapsed}">` +
                      headerInner +
                      chevronIconHtml +
                      `</button>`
                    : `<div class="tc-equipment-matrix-header">${headerInner}</div>`
                const bodyHtml =
                    `<div class="tc-equipment-matrix-body"${collapsed ? ' hidden' : ''}>` +
                    (columns === 'list' ? this._listHtml(section.items) : this._chipsHtml(section.items)) +
                    `</div>`
                return (
                    `<section class="tc-equipment-matrix-section` +
                    `${collapsed ? ' tc-equipment-matrix-section--collapsed' : ''}">` +
                    headerHtml +
                    bodyHtml +
                    `</section>`
                )
            })
            .join('')

        this.innerHTML = `<div class="tc-equipment-matrix">${html}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EquipmentMatrix
    }
}
