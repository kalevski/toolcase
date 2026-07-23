import { esc } from './internal/esc'
import { lucideByName } from './internal/lucide'

const TAG_NAME = 'tc-equipment-tag'

export type EquipmentFlag = 'included' | 'optional' | 'package'

// Default lucide glyph per feature_flag when no explicit `icon` is given.
// Shared with tc-equipment-matrix's dense list mode so the two renderings of
// the same `variant_equipment.flag` value never drift.
export const EQUIPMENT_FLAG_ICONS: Record<EquipmentFlag, string> = {
    included: 'check',
    optional: 'plus',
    package: 'package',
}

// Mono suffix chips for the non-standard flags ("OPT" / "PKG"); `included`
// speaks through its check glyph + success edge alone.
export const EQUIPMENT_FLAG_SUFFIX: Partial<Record<EquipmentFlag, string>> = {
    optional: 'OPT',
    package: 'PKG',
}

// tc-equipment-tag — one equipment item of the vehicle catalog (`equipment`
// table row), optionally carrying its per-variant feature_flag (`INCLUDED`,
// `OPTIONAL`, `PACKAGE` — the `variant_equipment.flag` enum). The flag is
// information, so it is rendered as color + a mono suffix, never as
// decoration: included = success edge + check, optional = neutral + "OPT",
// package = info tint + "PKG". Without a flag it is a plain neutral chip.
export class EquipmentTag extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['label', 'icon', 'flag']
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

    get flag(): EquipmentFlag | null {
        const raw = (this.getAttribute('flag') ?? '').toLowerCase()
        return raw === 'included' || raw === 'optional' || raw === 'package' ? raw : null
    }
    set flag(v: EquipmentFlag | null) {
        if (v) this.setAttribute('flag', v)
        else this.removeAttribute('flag')
    }

    private render(): void {
        const label = this.getAttribute('label') ?? ''
        const flag = this.flag
        const iconName = this.getAttribute('icon') ?? (flag ? EQUIPMENT_FLAG_ICONS[flag] : null)
        const iconHtml = iconName ? lucideByName(iconName, 'tc-equipment-tag-icon-svg') : ''
        const suffix = flag ? EQUIPMENT_FLAG_SUFFIX[flag] : undefined

        this.innerHTML =
            `<span class="tc-equipment-tag${flag ? ` tc-equipment-tag--${flag}` : ''}">` +
            (iconHtml ? `<span class="tc-equipment-tag-icon" aria-hidden="true">${iconHtml}</span>` : '') +
            `<span class="tc-equipment-tag-label">${esc(label)}</span>` +
            (suffix ? `<span class="tc-equipment-tag-suffix">${suffix}</span>` : '') +
            `</span>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: EquipmentTag
    }
}
