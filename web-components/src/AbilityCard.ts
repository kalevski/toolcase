import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-ability-card'

export type AbilityCardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
const RARITIES: AbilityCardRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function resolveIcon(name: string): string {
    const svgStr = (LucideIcons as Record<string, string>)[name]
    if (!svgStr) return ''
    return icon(svgStr)
}

export class AbilityCard extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return [
            'ability-name',
            'icon',
            'description',
            'cooldown',
            'cost',
            'range',
            'keybind',
            'rarity',
        ]
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

    // --- Public API ---

    get abilityName(): string {
        return this.getAttribute('ability-name') ?? ''
    }
    set abilityName(v: string) {
        if (v) this.setAttribute('ability-name', v)
        else this.removeAttribute('ability-name')
    }

    get icon(): string {
        return this.getAttribute('icon') ?? ''
    }
    set icon(v: string) {
        if (v) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    get description(): string {
        return this.getAttribute('description') ?? ''
    }
    set description(v: string) {
        if (v) this.setAttribute('description', v)
        else this.removeAttribute('description')
    }

    get cooldown(): string {
        return this.getAttribute('cooldown') ?? ''
    }
    set cooldown(v: string) {
        if (v) this.setAttribute('cooldown', v)
        else this.removeAttribute('cooldown')
    }

    get cost(): string {
        return this.getAttribute('cost') ?? ''
    }
    set cost(v: string) {
        if (v) this.setAttribute('cost', v)
        else this.removeAttribute('cost')
    }

    get range(): string {
        return this.getAttribute('range') ?? ''
    }
    set range(v: string) {
        if (v) this.setAttribute('range', v)
        else this.removeAttribute('range')
    }

    get keybind(): string {
        return this.getAttribute('keybind') ?? ''
    }
    set keybind(v: string) {
        if (v) this.setAttribute('keybind', v)
        else this.removeAttribute('keybind')
    }

    get rarity(): AbilityCardRarity {
        const v = this.getAttribute('rarity') as AbilityCardRarity
        return RARITIES.includes(v) ? v : 'common'
    }
    set rarity(v: AbilityCardRarity) {
        this.setAttribute('rarity', v)
    }

    private render(): void {
        const rarity = this.rarity
        // Reflect the rarity onto the host so themes / consumers can target a
        // specific tier without a JS read (matches the gc-* source behaviour).
        this.dataset.rarity = rarity
        // Manage the component class via classList so author-supplied classes survive.
        this.classList.add('tc-ability-card')

        const iconAttr = this.getAttribute('icon')
        const iconSvg = iconAttr ? resolveIcon(iconAttr) : ''
        const iconMarkup = `<div class="tc-ability-card-icon" aria-hidden="true">${iconSvg}</div>`

        const keybind = this.keybind
        const keybindMarkup = keybind
            ? `<kbd class="tc-ability-card-keybind">${esc(keybind)}</kbd>`
            : ''

        const description = this.description
        const descMarkup = description
            ? `<div class="tc-ability-card-description">${esc(description)}</div>`
            : ''

        const meta = [
            this.cooldown ? { label: 'Cooldown', value: this.cooldown } : null,
            this.cost ? { label: 'Cost', value: this.cost } : null,
            this.range ? { label: 'Range', value: this.range } : null,
        ].filter(Boolean) as { label: string; value: string }[]

        const metaMarkup = meta.length
            ? `<div class="tc-ability-card-meta">${meta
                  .map(
                      (m) =>
                          `<div class="tc-ability-card-meta-row">` +
                          `<span class="tc-ability-card-meta-label">${esc(m.label)}</span>` +
                          `<span class="tc-ability-card-meta-value">${esc(m.value)}</span>` +
                          `</div>`,
                  )
                  .join('')}</div>`
            : ''

        this.innerHTML = [
            '<div class="tc-ability-card-head">',
            iconMarkup,
            '<div class="tc-ability-card-headtext">',
            `<div class="tc-ability-card-rarity">${esc(rarity)}</div>`,
            `<div class="tc-ability-card-name">${esc(this.abilityName)}</div>`,
            '</div>',
            keybindMarkup,
            '</div>',
            descMarkup,
            metaMarkup,
        ].join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AbilityCard
    }
}
