import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-scoring-rules'

export type ScoringRuleAccent = 'pink' | 'yellow' | 'cyan' | 'green' | 'red'
const ACCENTS: ScoringRuleAccent[] = ['pink', 'yellow', 'cyan', 'green', 'red']

export interface ScoringRule {
    icon?: string
    title: string
    description: string
    points: string
    suffix?: string
    accent?: ScoringRuleAccent
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
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

export class ScoringRules extends HTMLElement {
    private _initialised = false
    private _rules: ScoringRule[] = []

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get rules(): ScoringRule[] {
        return this._rules
    }
    set rules(v: ScoringRule[]) {
        this._rules = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        this.classList.add('tc-scoring-rules')
        this.setAttribute('role', 'list')

        this.innerHTML = this._rules.map(rule => {
            const accentClass =
                rule.accent && (ACCENTS as string[]).includes(rule.accent)
                    ? ` tc-accent-${rule.accent}`
                    : ''

            const iconHtml = rule.icon
                ? `<span class="tc-scoring-rule-icon" aria-hidden="true">${lucideByName(rule.icon)}</span>`
                : ''

            const suffixHtml = rule.suffix
                ? `<span class="tc-scoring-rule-suffix">${esc(rule.suffix)}</span>`
                : ''

            return `<div class="tc-scoring-rule${accentClass}" role="listitem">${iconHtml}<div class="tc-scoring-rule-body"><div class="tc-scoring-rule-title">${esc(rule.title)}</div><div class="tc-scoring-rule-desc">${esc(rule.description)}</div></div><div class="tc-scoring-rule-points">${esc(rule.points)}${suffixHtml}</div></div>`
        }).join('')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ScoringRules
    }
}
