import { patchHtml } from './internal/patch-html'
import { setHostClass } from './internal/host-class'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const PANEL_TAG = 'tc-panel'
const HEADER_TAG = 'tc-panel-header'

// ── tc-panel ──────────────────────────────────────────────────────────────────

export class Panel extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['bordered']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get bordered(): boolean {
        return this.hasAttribute('bordered')
    }
    set bordered(value: boolean) {
        if (value) this.setAttribute('bordered', '')
        else this.removeAttribute('bordered')
    }

    /** THE HOST IS THE PANEL: a `tc-panel-header` child and the body content stay
     *  the consumer's own children and are ordered by CSS (rule 1). */
    private render(): void {
        const cls = ['tc-panel', this.bordered ? 'tc-panel--bordered' : '']
            .filter(Boolean)
            .join(' ')
        setHostClass(this, cls)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [PANEL_TAG]: Panel
    }
}

// ── tc-panel-header ───────────────────────────────────────────────────────────

export class PanelHeader extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['heading', 'icon']
    }

    connectedCallback(): void {
        this._initialised = true
        this.render()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get heading(): string {
        return this.getAttribute('heading') ?? ''
    }
    set heading(v: string) {
        if (v) this.setAttribute('heading', v)
        else this.removeAttribute('heading')
    }

    get icon(): string | null {
        return this.getAttribute('icon')
    }
    set icon(v: string | null) {
        if (v != null) this.setAttribute('icon', v)
        else this.removeAttribute('icon')
    }

    private render(): void {
        const heading = this.getAttribute('heading') ?? ''
        const iconName = this.getAttribute('icon')

        const svgStr = iconName ? (LucideIcons as Record<string, string>)[iconName] : null
        const iconHtml = svgStr
            ? `<span class="tc-panel-header-icon" aria-hidden="true">${icon(svgStr)}</span>`
            : ''
        // THE HOST IS THE HEADER ROW: the icon and heading are element-owned and
        // prepended; a `slot="action"` child the consumer wrote stays theirs and is
        // pushed to the end by CSS (rule 1).
        setHostClass(this, 'tc-panel-header')
        patchHtml(this, iconHtml + `<span class="tc-panel-header-heading">${esc(heading)}</span>`)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [HEADER_TAG]: PanelHeader
    }
}
