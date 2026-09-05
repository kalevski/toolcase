import { patchHtml } from './internal/patch-html'
import { consumerText, observeContent } from './internal/content-observer'
import { esc } from './internal/esc'
import * as LucideIcons from 'lucide-static'
import { icon } from './icons'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-code-snippet'

export type CodeSnippetLanguage = 'javascript' | 'typescript' | 'bash'
const LANGUAGES: CodeSnippetLanguage[] = ['javascript', 'typescript', 'bash']

function lucideIcon(name: string): string {
    const pascal = name
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')
    const svg = (LucideIcons as Record<string, string>)[pascal]
    return svg ? icon(svg) : ''
}

const copyIconHtml = lucideIcon('copy')
const checkIconHtml = lucideIcon('check')

// Token regex sources — order within alternation determines priority.
// Defined as string fragments to avoid module-level regex statefulness
// (each call to applyHighlight creates a fresh /g regex).
const JS_TOKEN_SRC =
    '(\\/\\/[^\\n]*)' + // (1) single-line comment
    '|(\\/\\*[\\s\\S]*?\\*\\/)' + // (2) block comment
    '|(`(?:[^`\\\\]|\\\\.)*`)' + // (3) template literal
    '|("(?:[^"\\\\]|\\\\.)*")' + // (4) double-quoted string
    "|(\'(?:[^\'\\\\]|\\\\.)*\')" + // (5) single-quoted string
    '|(\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b)' + // (6) number
    '|(\\b(?:const|let|var|function|return|if|else|for|while|class|new|typeof|instanceof|this|import|export|default|from|as|async|await|try|catch|finally|throw|true|false|null|undefined|void|break|continue|switch|case|of|in|do|extends|super|static|get|set|yield|delete|interface|type|enum|namespace|abstract|implements|public|private|protected|readonly|declare)\\b)' // (7) keyword

const BASH_TOKEN_SRC =
    '(#[^\\n]*)' + // (1) comment
    '|("(?:[^"\\\\]|\\\\.)*")' + // (2) double-quoted string
    "|(\'[^\']*\')" + // (3) single-quoted string (no escapes in bash)
    '|(\\$(?:\\{[^}]*\\}|\\([^)]*\\)|[a-zA-Z_][a-zA-Z0-9_]*|\\d+))' + // (4) variable
    '|(\\b\\d+\\b)' + // (5) number
    '|(\\b(?:if|then|else|elif|fi|for|do|done|while|until|echo|cd|ls|export|source|function|return|case|esac|in|exit|true|false|break|continue|shift|unset|set|local|mkdir|cp|mv|rm|cat|grep|sed|awk|curl|wget|git|npm|yarn|chmod|chown|sudo|apt|brew|pip|python|python3|node|bash|sh)\\b)' // (6) keyword

// Escape ONLY the three characters that are unsafe in element-text content.
// Crucially we leave quotes literal: the shared esc() turns ' into the numeric
// entity &#039;, whose digits the number tokenizer below then wraps in a span,
// corrupting the entity (it renders as a literal "&#039;"). Keeping quotes raw
// lets the string-token regexes match '…' / "…" correctly and emits no entity.
function escCode(value: string): string {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function applyHighlight(code: string, language: CodeSnippetLanguage): string {
    const escaped = escCode(code)

    if (language === 'javascript' || language === 'typescript') {
        return escaped.replace(
            new RegExp(JS_TOKEN_SRC, 'g'),
            (match, cline, cblock, tmpl, dbl, sgl, num, kw) => {
                if (cline !== undefined || cblock !== undefined)
                    return `<span class="tok-comment">${match}</span>`
                if (tmpl !== undefined || dbl !== undefined || sgl !== undefined)
                    return `<span class="tok-string">${match}</span>`
                if (num !== undefined) return `<span class="tok-number">${match}</span>`
                if (kw !== undefined) return `<span class="tok-keyword">${match}</span>`
                return match
            },
        )
    }

    if (language === 'bash') {
        return escaped.replace(
            new RegExp(BASH_TOKEN_SRC, 'g'),
            (match, comment, dbl, sgl, vari, num, kw) => {
                if (comment !== undefined) return `<span class="tok-comment">${match}</span>`
                if (dbl !== undefined || sgl !== undefined)
                    return `<span class="tok-string">${match}</span>`
                if (vari !== undefined) return `<span class="tok-variable">${match}</span>`
                if (num !== undefined) return `<span class="tok-number">${match}</span>`
                if (kw !== undefined) return `<span class="tok-keyword">${match}</span>`
                return match
            },
        )
    }

    return escaped
}

const SKEL_WIDTHS = ['60%', '85%', '70%', '45%', '90%', '55%']

export class CodeSnippet extends HTMLElement {
    private _initialised = false
    /** True when `code` was taken from the consumer's children rather than given
     *  as an attribute — the only case that should follow them. */
    private _codeFromContent = false
    private _copied = false
    private _copyTimer: ReturnType<typeof setTimeout> | null = null

    /** Optional copy callback — called with the copied code string after a successful write. */
    onCopy: ((code: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['code', 'language', 'title', 'show-copy-button', 'loading']
    }

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Slotted text-content fallback: capture textContent as code when
            // no code attribute is present (e.g. <tc-code-snippet>…</tc-code-snippet>).
            if (!this.hasAttribute('code')) {
                const text = consumerText(this)
                if (text) {
                    this._codeFromContent = true
                    this.setAttribute('code', text)
                }
            }
            this.render()
            this._initialised = true
        }
        // Code that came from the children is a COPY of them, so it has to be
        // re-taken when React rewrites them — otherwise the snippet keeps showing
        // code that is no longer in the tree (see content-observer.ts).
        observeContent(this, () => this._syncCodeFromContent())
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onHostClick)
    }

    /** Re-take the code from the children — only when that is where it came from,
     *  so an explicit `code` attribute is never overwritten. */
    private _syncCodeFromContent(): void {
        if (!this._codeFromContent) return
        const text = consumerText(this)
        if (text && text !== this.getAttribute('code')) this.setAttribute('code', text)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onHostClick)
        if (this._copyTimer !== null) {
            clearTimeout(this._copyTimer)
            this._copyTimer = null
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get code(): string {
        return this.getAttribute('code') ?? ''
    }
    set code(v: string) {
        setAttr(this, 'code', v)
    }

    get language(): CodeSnippetLanguage {
        const v = this.getAttribute('language') as CodeSnippetLanguage
        return LANGUAGES.includes(v) ? v : 'javascript'
    }
    set language(v: CodeSnippetLanguage) {
        setAttr(this, 'language', v)
    }

    // title reflects the native HTMLElement.title attribute — no override needed.

    get showCopyButton(): boolean {
        const v = this.getAttribute('show-copy-button')
        return v !== 'false'
    }
    set showCopyButton(v: boolean) {
        if (!v) this.setAttribute('show-copy-button', 'false')
        else this.removeAttribute('show-copy-button')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    private _onHostClick = (e: Event) => {
        const target = e.target as Element
        if (!target.closest('.tc-code-snippet-copy')) return
        void this._handleCopy()
    }

    private async _handleCopy(): Promise<void> {
        const code = this.getAttribute('code') ?? ''
        try {
            await navigator.clipboard.writeText(code)
        } catch {
            return
        }

        this.dispatchEvent(
            new CustomEvent('tc-copy', {
                bubbles: true,
                composed: true,
                detail: { code },
            }),
        )
        if (typeof this.onCopy === 'function') this.onCopy(code)

        this._setCopied(true)
        if (this._copyTimer !== null) clearTimeout(this._copyTimer)
        this._copyTimer = setTimeout(() => {
            this._setCopied(false)
            this._copyTimer = null
        }, 1500)
    }

    private _setCopied(copied: boolean): void {
        this._copied = copied
        const btn = this.querySelector<HTMLButtonElement>('.tc-code-snippet-copy')
        const status = this.querySelector<HTMLElement>('.tc-code-snippet-status')

        if (btn) {
            if (copied) {
                btn.innerHTML = `${checkIconHtml}<span class="tc-code-snippet-copy-lbl" aria-hidden="true">Copied</span>`
                btn.setAttribute('aria-label', 'Copied')
                btn.classList.add('tc-code-snippet-copy--copied')
            } else {
                btn.innerHTML = `${copyIconHtml}<span class="tc-code-snippet-copy-lbl" aria-hidden="true"></span>`
                btn.setAttribute('aria-label', 'Copy code')
                btn.classList.remove('tc-code-snippet-copy--copied')
            }
        }

        if (status) status.textContent = copied ? 'Copied' : ''
    }

    private render(): void {
        const code = this.getAttribute('code') ?? ''
        const language = this.language
        const titleAttr = this.getAttribute('title')
        const showCopyButton = this.showCopyButton
        const loading = this.hasAttribute('loading')

        if (loading) {
            patchHtml(
                this,
                `<div class="tc-code-snippet tc-code-snippet--loading" aria-busy="true">` +
                    `<div class="tc-code-snippet-skel">` +
                    SKEL_WIDTHS.map(
                        (w) => `<div class="tc-code-snippet-skel-line" style="width:${w}"></div>`,
                    ).join('') +
                    `</div>` +
                    `</div>`,
            )
            return
        }

        const titleText = titleAttr != null ? esc(titleAttr) : language.toUpperCase()
        const showHeader = titleAttr != null || showCopyButton

        const copyBtnHtml = showCopyButton
            ? `<button class="tc-code-snippet-copy${this._copied ? ' tc-code-snippet-copy--copied' : ''}" ` +
              `type="button" aria-label="${this._copied ? 'Copied' : 'Copy code'}">` +
              `${this._copied ? checkIconHtml : copyIconHtml}` +
              `<span class="tc-code-snippet-copy-lbl" aria-hidden="true">${this._copied ? 'Copied' : ''}</span>` +
              `</button>`
            : ''

        const headerHtml = showHeader
            ? `<div class="tc-code-snippet-header">` +
              `<span class="tc-code-snippet-title">${titleText}</span>` +
              copyBtnHtml +
              `</div>`
            : ''

        const highlightedCode = applyHighlight(code, language)

        patchHtml(
            this,
            `<div class="tc-code-snippet">` +
                headerHtml +
                `<pre class="tc-code-snippet-pre"><code class="tc-code-snippet-code language-${esc(language)}">${highlightedCode}</code></pre>` +
                `<div class="tc-code-snippet-status" role="status" aria-live="polite"></div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CodeSnippet
    }
}
