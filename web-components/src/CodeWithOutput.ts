import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'
const TAG_NAME = 'tc-code-with-output'

export type CodeWithOutputLanguage = 'javascript' | 'typescript' | 'bash'
export type CodeWithOutputLayout = 'split' | 'stacked'

const LANGUAGES: CodeWithOutputLanguage[] = ['javascript', 'typescript', 'bash']
const LAYOUTS: CodeWithOutputLayout[] = ['split', 'stacked']

export class CodeWithOutput extends HTMLElement {
    private _initialised = false
    private _output: string = ''
    private _error: string = ''

    private _titleSlotNodes: Node[] = []
    private _outputSlotNodes: Node[] = []
    private _errorSlotNodes: Node[] = []

    static get observedAttributes(): string[] {
        return ['code', 'language', 'layout', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Capture named-slot children before render() wipes innerHTML
            this._titleSlotNodes = Array.from(this.querySelectorAll('[slot="title"]'))
            this._outputSlotNodes = Array.from(this.querySelectorAll('[slot="output"]'))
            this._errorSlotNodes = Array.from(this.querySelectorAll('[slot="error"]'))

            this.render()
            this._distributeSlots()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get code(): string {
        return this.getAttribute('code') ?? ''
    }
    set code(v: string) {
        setAttr(this, 'code', v)
    }

    get language(): CodeWithOutputLanguage {
        const v = this.getAttribute('language') as CodeWithOutputLanguage
        return LANGUAGES.includes(v) ? v : 'javascript'
    }
    set language(v: CodeWithOutputLanguage) {
        setAttr(this, 'language', v)
    }

    get layout(): CodeWithOutputLayout {
        const v = this.getAttribute('layout') as CodeWithOutputLayout
        return LAYOUTS.includes(v) ? v : 'split'
    }
    set layout(v: CodeWithOutputLayout) {
        setAttr(this, 'layout', v)
    }

    get output(): string {
        return this._output
    }
    set output(v: string) {
        this._output = typeof v === 'string' ? v : ''
        if (this._initialised) this._rerenderWithSlots()
    }

    get error(): string {
        return this._error
    }
    set error(v: string) {
        this._error = typeof v === 'string' ? v : ''
        if (this._initialised) this._rerenderWithSlots()
    }

    private get _hasError(): boolean {
        return this._error.length > 0 || this._errorSlotNodes.length > 0
    }

    private _rerenderWithSlots(): void {
        // Re-capture slot nodes from within their permanent containers
        this._titleSlotNodes = Array.from(this.querySelectorAll('.tc-cwo-title [slot="title"]'))
        this._outputSlotNodes = Array.from(
            this.querySelectorAll('.tc-cwo-normal-content [slot="output"]'),
        )
        this._errorSlotNodes = Array.from(
            this.querySelectorAll('.tc-cwo-error-content [slot="error"]'),
        )

        this.render()
        this._distributeSlots()
    }

    private _distributeSlots(): void {
        // Title slot
        if (this._titleSlotNodes.length > 0) {
            const titleEl = this.querySelector('.tc-cwo-title')
            if (titleEl) this._titleSlotNodes.forEach((n) => titleEl.appendChild(n))
        }

        // Output slot (always present in DOM — normal content container)
        const normalBody = this.querySelector('.tc-cwo-normal-content')
        if (normalBody) this._outputSlotNodes.forEach((n) => normalBody.appendChild(n))

        // Error slot (always present in DOM — error content container)
        const errorBody = this.querySelector('.tc-cwo-error-content')
        if (errorBody) this._errorSlotNodes.forEach((n) => errorBody.appendChild(n))
    }

    private render(): void {
        const code = this.getAttribute('code') ?? ''
        const language = this.language
        const layout = this.layout
        const titleAttr = this.getAttribute('title')
        const hasError = this._hasError

        const hasTitleContent = titleAttr != null || this._titleSlotNodes.length > 0
        const titleHtml = hasTitleContent
            ? `<div class="tc-cwo-title">${titleAttr != null ? esc(titleAttr) : ''}</div>`
            : ''

        // JS-property content (raw HTML) goes into the corresponding container;
        // slot children are appended after render in _distributeSlots().
        const normalBodyHtml = this._output || ''
        const errorBodyHtml = this._error || ''

        const layoutClass = layout === 'stacked' ? 'tc-cwo-stacked' : 'tc-cwo-split'
        const errorClass = hasError ? ' tc-cwo-output-error' : ''
        const alertRole = hasError ? ' role="alert"' : ''

        patchHtml(
            this,
            `<div class="tc-cwo ${layoutClass}">` +
                titleHtml +
                `<div class="tc-cwo-panes">` +
                `<div class="tc-cwo-code">` +
                `<div class="tc-cwo-code-header">` +
                `<span class="tc-cwo-lang">${esc(language.toUpperCase())}</span>` +
                `</div>` +
                `<pre><code class="tc-cwo-code-block">${esc(code)}</code></pre>` +
                `</div>` +
                `<div class="tc-cwo-output${errorClass}"${alertRole}>` +
                `<div class="tc-cwo-output-body tc-cwo-normal-content">${normalBodyHtml}</div>` +
                `<div class="tc-cwo-output-body tc-cwo-error-content">${errorBodyHtml}</div>` +
                `</div>` +
                `</div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CodeWithOutput
    }
}
