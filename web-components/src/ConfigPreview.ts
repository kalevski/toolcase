import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-config-preview'

export interface ConfigPreviewEntry {
    key: string
    value: string | number | boolean | null
    comment?: string
}

export class ConfigPreview extends HTMLElement {
    private _initialised = false
    private _entries: ConfigPreviewEntry[] = []

    static get observedAttributes(): string[] {
        return ['live-label']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get liveLabel(): string | null {
        return this.getAttribute('live-label')
    }
    set liveLabel(v: string | null) {
        if (v != null) this.setAttribute('live-label', v)
        else this.removeAttribute('live-label')
    }

    get entries(): ConfigPreviewEntry[] {
        return this._entries
    }
    set entries(v: ConfigPreviewEntry[]) {
        this._entries = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        // Re-capture named-slot nodes from their distributed container
        const liveLabelEl = this.querySelector('.tc-config-preview-live-label')
        const liveLabelNodes = liveLabelEl
            ? Array.from(liveLabelEl.querySelectorAll('[slot="live-label"]'))
            : []
        // Re-capture default slot children from content container
        const contentEl = this.querySelector('.tc-config-preview-content')
        const defaultNodes = contentEl ? Array.from(contentEl.childNodes) : []

        this.render()

        // Re-distribute live-label slot children (only when no attribute)
        if (!this.hasAttribute('live-label')) {
            const newLiveLabelEl = this.querySelector('.tc-config-preview-live-label')
            if (newLiveLabelEl) liveLabelNodes.forEach((n) => newLiveLabelEl.appendChild(n))
        }
        // Re-distribute default slot children
        const newContentEl = this.querySelector('.tc-config-preview-content')
        if (newContentEl) defaultNodes.forEach((n) => newContentEl.appendChild(n))
    }

    private render(): void {
        const liveLabel = this.getAttribute('live-label')

        // Build entry lines; no newlines in the HTML to avoid whitespace in <pre>
        const entriesHtml = this._entries
            .map((entry) => {
                const keyHtml = `<span class="tc-config-preview-key">${esc(entry.key)}</span>`

                let valueClass = 'tc-config-preview-value'
                let valueText: string
                if (typeof entry.value === 'string') {
                    valueClass += ' tc-config-preview-value--string'
                    valueText = `&quot;${esc(entry.value)}&quot;`
                } else if (typeof entry.value === 'number') {
                    valueClass += ' tc-config-preview-value--number'
                    valueText = esc(String(entry.value))
                } else if (typeof entry.value === 'boolean') {
                    valueClass += ' tc-config-preview-value--boolean'
                    valueText = entry.value ? 'true' : 'false'
                } else {
                    valueClass += ' tc-config-preview-value--null'
                    valueText = 'null'
                }
                const valueHtml = `<span class="${valueClass}">${valueText}</span>`

                const commentHtml = entry.comment
                    ? `<span class="tc-config-preview-comment"> // ${esc(entry.comment)}</span>`
                    : ''

                return `<span class="tc-config-preview-line">${keyHtml}: ${valueHtml}${commentHtml}</span>`
            })
            .join('')

        // Live-label text (attribute takes precedence over slot)
        const liveLabelText = liveLabel != null ? esc(liveLabel) : ''

        // THE HOST IS THE PREVIEW. The header and the entry lines are
        // element-owned; a `slot="live-label"` element and the extra lines the
        // consumer wrote stay their children and are placed by CSS (rule 1).
        const liveLabelHtml =
            liveLabel != null
                ? `<span class="tc-config-preview-live-label">${liveLabelText}</span>`
                : ''
        setHostClass(this, 'tc-config-preview')
        patchHtml(
            this,
            `<div class="tc-config-preview-header"><span class="tc-config-preview-live-badge">` +
                `<span class="tc-config-preview-live-dot" aria-hidden="true"></span>${liveLabelHtml}` +
                `</span></div>` +
                `<pre class="tc-config-preview-body">${entriesHtml}</pre>`,
            { region: 'chrome' },
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConfigPreview
    }
}
