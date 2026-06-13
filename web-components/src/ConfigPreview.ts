const TAG_NAME = 'tc-config-preview'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

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
        if (!this._initialised) {
            // Capture named-slot "live-label" nodes (direct children only)
            const liveLabelNodes = Array.from(this.children).filter(
                el => el.getAttribute('slot') === 'live-label'
            ) as Element[]
            // Capture default nodes (excluding named-slot nodes)
            const defaultNodes = Array.from(this.childNodes).filter(
                n => !(n instanceof Element && n.getAttribute('slot') === 'live-label')
            )
            this.render()
            // Re-append live-label slot children when no attribute overrides them
            if (!this.hasAttribute('live-label')) {
                const liveLabelEl = this.querySelector('.tc-config-preview-live-label')
                if (liveLabelEl) liveLabelNodes.forEach(n => liveLabelEl.appendChild(n))
            }
            // Re-append default slot children
            const contentEl = this.querySelector('.tc-config-preview-content')
            if (contentEl) defaultNodes.forEach(n => contentEl.appendChild(n))
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
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
            if (newLiveLabelEl) liveLabelNodes.forEach(n => newLiveLabelEl.appendChild(n))
        }
        // Re-distribute default slot children
        const newContentEl = this.querySelector('.tc-config-preview-content')
        if (newContentEl) defaultNodes.forEach(n => newContentEl.appendChild(n))
    }

    private render(): void {
        const liveLabel = this.getAttribute('live-label')

        // Build entry lines; no newlines in the HTML to avoid whitespace in <pre>
        const entriesHtml = this._entries.map(entry => {
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
        }).join('')

        // Live-label text (attribute takes precedence over slot)
        const liveLabelText = liveLabel != null ? esc(liveLabel) : ''

        const header = `<div class="tc-config-preview-header"><span class="tc-config-preview-live-badge"><span class="tc-config-preview-live-dot" aria-hidden="true"></span><span class="tc-config-preview-live-label">${liveLabelText}</span></span></div>`
        const body = `<pre class="tc-config-preview-body">${entriesHtml}<span class="tc-config-preview-content"></span></pre>`

        this.innerHTML = `<div class="tc-config-preview">${header}${body}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ConfigPreview
    }
}
