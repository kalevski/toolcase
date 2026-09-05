import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-markdown-editor'

let _idCounter = 0

type EditorTab = 'write' | 'preview'

interface ToolbarAction {
    label: string
    icon: string
    wrap: [string, string]
}

// Formatting toolbar — each entry wraps/prefixes the current selection. lucide
// glyph names (kebab-case) resolved through lucideByName() into inline SVG.
const TOOLBAR_ACTIONS: ToolbarAction[] = [
    { label: 'Bold', icon: 'bold', wrap: ['**', '**'] },
    { label: 'Italic', icon: 'italic', wrap: ['*', '*'] },
    { label: 'Heading', icon: 'heading-1', wrap: ['# ', ''] },
    { label: 'Link', icon: 'link', wrap: ['[', '](url)'] },
    { label: 'List', icon: 'list', wrap: ['- ', ''] },
    { label: 'Quote', icon: 'quote', wrap: ['> ', ''] },
    { label: 'Code', icon: 'code', wrap: ['`', '`'] },
]

const DEFAULT_PLACEHOLDER = 'Write some **Markdown**…'

// Escape only the three text-level entities — used inside the markdown renderer,
// where attribute quoting is handled separately per-attribute.
function escapeText(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Pre-resolve the static toolbar glyphs once at module load.
const TOOLBAR_ICONS: Record<string, string> = {}
TOOLBAR_ACTIONS.forEach((a) => {
    TOOLBAR_ICONS[a.icon] = lucideByName(a.icon)
})

// ── Minimal, safe Markdown → HTML ─────────────────────────────────────────────
// Compact internal renderer (no heavy dependency). All text is HTML-escaped and
// link hrefs are protocol-sanitised, so untrusted markdown cannot inject markup.
function markdownToHtml(md: string): string {
    if (!md.trim()) return ''

    // Pull fenced code blocks out first so their content is never parsed as
    // markdown; restore them after all inline/block rules have run.
    const blocks: string[] = []
    let src = md.replace(/```[^\n]*\n?([\s\S]*?)```/g, (_m, code: string) => {
        const i =
            blocks.push(
                `<pre class="tc-markdown-editor-codeblock"><code>${escapeText(code.replace(/\n$/, ''))}</code></pre>`,
            ) - 1
        return `\u0000BLOCK${i}\u0000`
    })

    src = escapeText(src)
        // Headings
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Bold / italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Links — sanitise href to a safe scheme; quote-escape for the attribute
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
            const trimmed = url.trim()
            const safe = /^(https?:|mailto:|\/|#|\.)/i.test(trimmed) ? trimmed : '#'
            return `<a href="${safe.replace(/"/g, '&quot;')}" rel="noopener noreferrer" target="_blank">${text}</a>`
        })
        // Blockquote
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // List items (unordered + ordered)
        .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>')
        .replace(/^\s*\d+\. (.+)$/gm, '<li>$1</li>')
        // Horizontal rule
        .replace(/^---+$/gm, '<hr>')
        // Paragraph break
        .replace(/\n{2,}/g, '</p><p>')

    let html = `<p>${src}</p>`
        .replace(/<p>\s*<\/p>/g, '')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')

    // Restore fenced blocks and unwrap any paragraph the placeholder left around them.
    html = html
        .replace(/\u0000BLOCK(\d+)\u0000/g, (_m, i: string) => blocks[Number(i)])
        .replace(/<p>(<pre[\s\S]*?<\/pre>)<\/p>/g, '$1')

    return html
}

function resolveLength(raw: string | null): string | null {
    if (raw === null) return null
    const t = raw.trim()
    return /^\d+(\.\d+)?$/.test(t) ? `${t}px` : t
}

export class MarkdownEditor extends HTMLElement {
    private _initialised = false
    private _value = ''
    private _tab: EditorTab = 'write'
    private _editorId: string
    private _bodyId: string
    private _writeTabId: string
    private _previewTabId: string

    /** Optional callback mirror of the tc-change event. */
    onChange: ((value: string) => void) | null = null

    static get observedAttributes(): string[] {
        return ['value', 'placeholder', 'height', 'toolbar', 'label', 'disabled']
    }

    constructor() {
        super()
        const uid = ++_idCounter
        this._editorId = `tc-md-editor-${uid}`
        this._bodyId = `tc-md-editor-body-${uid}`
        this._writeTabId = `tc-md-editor-write-${uid}`
        this._previewTabId = `tc-md-editor-preview-${uid}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._value = this.getAttribute('value') ?? ''
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback
        // removes them, and a move/remount (React reconciliation) disconnects
        // then reconnects without re-running the one-time init above. Adding the
        // same handler reference twice is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onClick)
        this.addEventListener('keydown', this._onKeydown)
        this.addEventListener('input', this._onInput)
        this.addEventListener('mousedown', this._onMouseDown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('keydown', this._onKeydown)
        this.removeEventListener('input', this._onInput)
        this.removeEventListener('mousedown', this._onMouseDown)
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'value') {
            const v = next ?? ''
            if (v !== this._value) {
                this._value = v
                this._patchValue()
            }
            return
        }
        this.render()
    }

    // ── Props ────────────────────────────────────────────────────────────────

    get value(): string {
        return this._value
    }
    set value(v: string) {
        const s = v ?? ''
        this._value = s
        // Reflect for controlled use; the attribute callback no-ops since _value
        // already matches, so patch the live DOM here directly (idempotent —
        // a no-op before the element is rendered).
        if (this.getAttribute('value') !== s) this.setAttribute('value', s)
        this._patchValue()
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? DEFAULT_PLACEHOLDER
    }
    set placeholder(v: string) {
        setAttr(this, 'placeholder', v)
    }

    get height(): string | null {
        return this.getAttribute('height')
    }
    set height(v: string | null) {
        if (v != null) this.setAttribute('height', v)
        else this.removeAttribute('height')
    }

    /** Toolbar is shown by default; set toolbar="false" to hide it. */
    get toolbar(): boolean {
        return this.getAttribute('toolbar') !== 'false'
    }
    set toolbar(v: boolean) {
        if (v) this.removeAttribute('toolbar')
        else this.setAttribute('toolbar', 'false')
    }

    get label(): string | null {
        return this.getAttribute('label')
    }
    set label(v: string | null) {
        if (v != null) this.setAttribute('label', v)
        else this.removeAttribute('label')
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    // ── Value sync ─────────────────────────────────────────────────────────────

    /** Update the live textarea / preview pane without a full re-render. */
    private _patchValue(): void {
        const ta = this.querySelector<HTMLTextAreaElement>('textarea')
        if (ta && ta.value !== this._value) ta.value = this._value
        const preview = this.querySelector<HTMLElement>('.tc-markdown-editor-preview')
        if (preview) preview.innerHTML = this._renderPreviewBody()
    }

    private _dispatchChange(): void {
        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { value: this._value },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange(this._value)
    }

    // ── Events ──────────────────────────────────────────────────────────────────

    private _onInput = (e: Event): void => {
        const ta = e.target as HTMLElement
        if (ta.tagName !== 'TEXTAREA') return
        this._value = (ta as HTMLTextAreaElement).value
        this._dispatchChange()
    }

    private _onClick = (e: Event): void => {
        const target = e.target as Element
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (tab && this.contains(tab)) {
            const next = tab.dataset.tab as EditorTab | undefined
            if (next && next !== this._tab) this._setTab(next, true)
            return
        }
    }

    // Toolbar buttons act on mousedown so the textarea keeps focus/selection.
    private _onMouseDown = (e: MouseEvent): void => {
        const target = e.target as Element
        const btn = target.closest<HTMLElement>('.tc-markdown-editor-toolbar-btn')
        if (!btn || !this.contains(btn) || this.disabled) return
        e.preventDefault()
        const idx = Number(btn.dataset.idx)
        const action = TOOLBAR_ACTIONS[idx]
        if (action) this._applyWrap(action.wrap)
    }

    private _onKeydown = (e: KeyboardEvent): void => {
        const target = e.target as Element

        // Tab-strip roving navigation.
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (tab && this.contains(tab)) {
            let dir = 0
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dir = 1
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dir = -1
            else if (e.key === 'Home') {
                e.preventDefault()
                this._setTab('write', true)
                return
            } else if (e.key === 'End') {
                e.preventDefault()
                this._setTab('preview', true)
                return
            }
            if (dir !== 0) {
                e.preventDefault()
                this._setTab(this._tab === 'write' ? 'preview' : 'write', true)
            }
            return
        }

        // Textarea: Tab inserts indentation instead of leaving the field.
        if (
            target.tagName === 'TEXTAREA' &&
            e.key === 'Tab' &&
            !e.shiftKey &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.altKey
        ) {
            e.preventDefault()
            this._insertAtCursor('  ')
        }
    }

    // ── Behaviour ────────────────────────────────────────────────────────────────

    private _setTab(tab: EditorTab, focusTab: boolean): void {
        this._tab = tab
        this.render()
        if (focusTab) {
            const id = tab === 'write' ? this._writeTabId : this._previewTabId
            this.querySelector<HTMLElement>(`#${id}`)?.focus()
        }
    }

    private _applyWrap(wrap: [string, string]): void {
        const ta = this.querySelector<HTMLTextAreaElement>('textarea')
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const selectedText = this._value.slice(start, end)
        const selected = selectedText !== '' ? selectedText : wrap[1] === '' ? '' : 'text'
        const next =
            this._value.slice(0, start) + wrap[0] + selected + wrap[1] + this._value.slice(end)
        this._value = next
        ta.value = next
        this._dispatchChange()
        ta.focus()
        const caret = start + wrap[0].length
        ta.setSelectionRange(caret, caret + selected.length)
    }

    private _insertAtCursor(text: string): void {
        const ta = this.querySelector<HTMLTextAreaElement>('textarea')
        if (!ta) return
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const next = this._value.slice(0, start) + text + this._value.slice(end)
        this._value = next
        ta.value = next
        this._dispatchChange()
        const caret = start + text.length
        ta.setSelectionRange(caret, caret)
    }

    // ── Render ────────────────────────────────────────────────────────────────────

    private _renderPreviewBody(): string {
        const html = markdownToHtml(this._value)
        return html || `<p class="tc-markdown-editor-empty">Nothing to preview.</p>`
    }

    private render(): void {
        const label = this.label
        const disabled = this.disabled
        const showToolbar = this.toolbar
        const height = resolveLength(this.height) ?? '360px'
        const isWrite = this._tab === 'write'

        this.classList.toggle('tc-markdown-editor--disabled', disabled)

        const labelHtml = label
            ? `<label class="form-label tc-markdown-editor-label" for="${this._editorId}">${esc(label)}</label>`
            : ''

        // Always render the toolbar (when enabled) and merely hide it in preview,
        // so the tab strip keeps the exact same height across Write/Preview — the
        // tabs (and the body below) don't jump when the toolbar comes and goes.
        const toolbarHidden = !isWrite
        const toolbarBtnDisabled = disabled || toolbarHidden
        const toolbarHtml = showToolbar
            ? `<div class="tc-markdown-editor-toolbar${toolbarHidden ? ' tc-markdown-editor-toolbar--hidden' : ''}"` +
              ` role="group" aria-label="Formatting"${toolbarHidden ? ' aria-hidden="true"' : ''}>` +
              TOOLBAR_ACTIONS.map(
                  (a, i) =>
                      `<button type="button" class="tc-markdown-editor-toolbar-btn"` +
                      ` data-idx="${i}" title="${esc(a.label)}" aria-label="${esc(a.label)}"` +
                      (toolbarBtnDisabled ? ' disabled' : '') +
                      `>${TOOLBAR_ICONS[a.icon] ?? ''}</button>`,
              ).join('') +
              `</div>`
            : ''

        const tabBtn = (id: string, tab: EditorTab, text: string): string => {
            const active = this._tab === tab
            return (
                `<button id="${id}" type="button" role="tab" data-tab="${tab}"` +
                ` class="tc-markdown-editor-tab${active ? ' tc-markdown-editor-tab--active' : ''}"` +
                ` aria-selected="${active}" aria-controls="${this._bodyId}"` +
                ` tabindex="${active ? '0' : '-1'}">${text}</button>`
            )
        }

        const accessibleName = label ? '' : ` aria-label="Markdown editor"`
        const bodyHtml = isWrite
            ? `<textarea id="${this._editorId}" class="tc-markdown-editor-textarea form-control"` +
              ` placeholder="${esc(this.placeholder)}" spellcheck="true"${accessibleName}` +
              (disabled ? ' disabled' : '') +
              `>${esc(this._value)}</textarea>`
            : `<div class="tc-markdown-editor-preview">${this._renderPreviewBody()}</div>`

        const activeTabId = isWrite ? this._writeTabId : this._previewTabId

        patchHtml(
            this,
            labelHtml +
                `<div class="tc-markdown-editor-shell" style="height:${esc(height)}">` +
                `<div class="tc-markdown-editor-tabs">` +
                `<div class="tc-markdown-editor-tablist" role="tablist" aria-label="Editor mode">` +
                tabBtn(this._writeTabId, 'write', 'Write') +
                tabBtn(this._previewTabId, 'preview', 'Preview') +
                `</div>` +
                toolbarHtml +
                `</div>` +
                `<div id="${this._bodyId}" class="tc-markdown-editor-body" role="tabpanel"` +
                ` aria-labelledby="${activeTabId}">${bodyHtml}</div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: MarkdownEditor
    }
}
