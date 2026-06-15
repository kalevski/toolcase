import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-achievement-list'

export interface Achievement {
    id: string
    name: string
    description?: string
    icon?: string
    unlocked?: boolean
    progress?: number
    target?: number
    points?: number
    secret?: boolean
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

// Default state glyphs (resolved once) — lucide inline SVG, never unicode/emoji.
const unlockedIconHtml = lucideByName('award')
const lockedIconHtml = lucideByName('lock')
const secretIconHtml = lucideByName('help-circle')

export class AchievementList extends HTMLElement {
    private _initialised = false
    private _achievements: Achievement[] = []

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('role')) this.setAttribute('role', 'list')
            this.render()
            this._initialised = true
        }
    }

    get achievements(): Achievement[] {
        return this._achievements.slice()
    }
    set achievements(value: Achievement[]) {
        this._achievements = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.render()
    }

    private render(): void {
        this.classList.add('tc-achievement-list')

        this.innerHTML = this._achievements.map(a => {
            const isSecret = !!a.secret && !a.unlocked
            const hasProgress =
                !a.unlocked &&
                typeof a.progress === 'number' &&
                typeof a.target === 'number' &&
                a.target > 0

            const stateCls = a.unlocked
                ? 'is-unlocked'
                : hasProgress
                  ? 'is-in-progress'
                  : 'is-locked'
            const cls = `tc-achievement-list-row ${stateCls}${isSecret ? ' is-secret' : ''}`

            // Icon: user-supplied lucide name wins; otherwise a state glyph.
            const customIcon = a.icon ? lucideByName(a.icon) : ''
            const iconHtml = isSecret
                ? secretIconHtml
                : a.unlocked
                  ? customIcon || unlockedIconHtml
                  : customIcon || lockedIconHtml

            const name = isSecret ? '???' : esc(a.name)
            const description = isSecret
                ? 'Hidden achievement.'
                : a.description
                  ? esc(a.description)
                  : ''
            const descMarkup = description
                ? `<span class="tc-achievement-list-description">${description}</span>`
                : ''

            const pointsMarkup =
                typeof a.points === 'number' && !isSecret
                    ? `<span class="tc-achievement-list-points">${esc(String(a.points))}</span>`
                    : ''

            let progressMarkup = ''
            if (hasProgress) {
                const pct = Math.max(
                    0,
                    Math.min(100, ((a.progress as number) / (a.target as number)) * 100),
                )
                progressMarkup = `<div class="tc-achievement-list-progress"><div class="tc-achievement-list-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="${a.target}" aria-valuenow="${a.progress}"><div class="tc-achievement-list-progress-fill" style="width:${pct.toFixed(2)}%;"></div></div><span class="tc-achievement-list-progress-count">${esc(String(a.progress))}/${esc(String(a.target))}</span></div>`
            }

            return `<div role="listitem" class="${cls}" data-id="${esc(a.id)}"><span class="tc-achievement-list-icon" aria-hidden="true">${iconHtml}</span><div class="tc-achievement-list-text"><span class="tc-achievement-list-name">${name}</span>${descMarkup}${progressMarkup}</div>${pointsMarkup}</div>`
        }).join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AchievementList
    }
}
