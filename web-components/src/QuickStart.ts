import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'

const TAG_NAME = 'tc-quick-start'

const copyIconHtml = lucideByName('copy')

export interface QuickStartStep {
    title: string
    description?: string
    code?: string
    output?: string
    language?: string
}

export class QuickStart extends HTMLElement {
    private _initialised = false
    private _steps: QuickStartStep[] = []

    static get observedAttributes(): string[] {
        return ['title-text']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        // Re-attach on every connect: disconnectedCallback removes this, and a
        // move/remount disconnects then reconnects without re-running the
        // one-time init. Re-adding the same handler reference is a no-op.
        this.addEventListener('click', this._handleClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._handleClick)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get titleText(): string | null {
        return this.getAttribute('title-text')
    }
    set titleText(v: string | null) {
        if (v != null) this.setAttribute('title-text', v)
        else this.removeAttribute('title-text')
    }

    get steps(): QuickStartStep[] {
        return this._steps
    }
    set steps(v: QuickStartStep[]) {
        this._steps = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _handleClick = (e: Event): void => {
        const btn = (e.target as Element).closest('[data-code]')
        if (!btn) return
        const code = (btn as HTMLElement).dataset.code ?? ''
        this.dispatchEvent(
            new CustomEvent('tc-copy', {
                bubbles: true,
                composed: true,
                detail: { code },
            }),
        )
    }

    private render(): void {
        const titleText = this.getAttribute('title-text')

        const titleHtml =
            titleText != null ? `<h2 class="tc-quick-start-title">${esc(titleText)}</h2>` : ''

        const stepsHtml =
            this._steps.length > 0
                ? `<ol class="tc-quick-start">${this._steps
                      .map((step, i) => {
                          const num = String(i + 1)

                          const descHtml = step.description
                              ? `<p class="tc-quick-start-step-desc">${esc(step.description)}</p>`
                              : ''

                          const codeHtml =
                              step.code != null
                                  ? `<div class="tc-quick-start-code-wrap">` +
                                    `<pre class="tc-quick-start-code"><code>${esc(step.code)}</code></pre>` +
                                    `<button class="tc-quick-start-copy" type="button" aria-label="Copy code" data-code="${esc(step.code)}">${copyIconHtml}</button>` +
                                    `</div>`
                                  : ''

                          const outputHtml =
                              step.output != null
                                  ? `<pre class="tc-quick-start-output">${esc(step.output)}</pre>`
                                  : ''

                          return (
                              `<li class="tc-quick-start-step">` +
                              `<span class="tc-quick-start-marker" aria-hidden="true">${esc(num)}</span>` +
                              `<div class="tc-quick-start-body">` +
                              `<h3 class="tc-quick-start-step-title">${esc(step.title)}</h3>` +
                              descHtml +
                              codeHtml +
                              outputHtml +
                              `</div>` +
                              `</li>`
                          )
                      })
                      .join('')}</ol>`
                : '<ol class="tc-quick-start"></ol>'

        this.innerHTML = titleHtml + stepsHtml
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QuickStart
    }
}
