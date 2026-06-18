import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-migration-guide'

export interface MigrationStep {
    title: string
    description?: string
    before?: string
    after?: string
    language?: string
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

const arrowRightIconHtml = lucideByName('arrow-right')

export class MigrationGuide extends HTMLElement {
    private _initialised = false
    private _steps: MigrationStep[] = []

    static get observedAttributes(): string[] {
        return ['from', 'to', 'title']
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

    get from(): string {
        return this.getAttribute('from') ?? ''
    }
    set from(v: string) {
        this.setAttribute('from', v)
    }

    get to(): string {
        return this.getAttribute('to') ?? ''
    }
    set to(v: string) {
        this.setAttribute('to', v)
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get steps(): MigrationStep[] {
        return this._steps
    }
    set steps(v: MigrationStep[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private render(): void {
        const from = this.getAttribute('from') ?? ''
        const to = this.getAttribute('to') ?? ''
        const titleAttr = this.getAttribute('title')
        const title = titleAttr != null ? titleAttr : `Migrating from ${from} to ${to}`

        const stepsHtml = this._steps.length > 0
            ? `<ol class="tc-migration-guide__steps">${
                this._steps.map((step, i) => {
                    const num = String(i + 1).padStart(2, '0')

                    const descHtml = step.description
                        ? `<p class="tc-migration-step__desc">${esc(step.description)}</p>`
                        : ''

                    const beforeHtml = step.before != null
                        ? `<div class="tc-migration-diff-before"><pre><code>${esc(step.before)}</code></pre></div>`
                        : ''
                    const afterHtml = step.after != null
                        ? `<div class="tc-migration-diff-after"><pre><code>${esc(step.after)}</code></pre></div>`
                        : ''

                    const diffHtml = (step.before != null || step.after != null)
                        ? `<div class="tc-migration-diff">${beforeHtml}${afterHtml}</div>`
                        : ''

                    return (
                        `<li class="tc-migration-step">` +
                            `<span class="tc-migration-step__num">${esc(num)}</span>` +
                            `<div class="tc-migration-step__body">` +
                                `<p class="tc-migration-step__title">${esc(step.title)}</p>` +
                                descHtml +
                                diffHtml +
                            `</div>` +
                        `</li>`
                    )
                }).join('')
            }</ol>`
            : ''

        this.innerHTML =
            `<div class="tc-migration-guide">` +
                `<div class="tc-migration-guide__header">` +
                    `<div class="tc-migration-guide__versions">` +
                        `<span class="tc-migration-guide__version">${esc(from)}</span>` +
                        `<span class="tc-migration-guide__arrow">${arrowRightIconHtml}</span>` +
                        `<span class="tc-migration-guide__version">${esc(to)}</span>` +
                    `</div>` +
                    `<p class="tc-migration-guide__title">${esc(title)}</p>` +
                `</div>` +
                stepsHtml +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MigrationGuide
    }
}
