const TAG_NAME = 'tc-diff-viewer'

export type DiffViewerMode = 'split' | 'unified'
const MODES: DiffViewerMode[] = ['split', 'unified']

type LineKind = 'unchanged' | 'added' | 'removed'

interface DiffLine {
    kind: LineKind
    beforeNum?: number
    afterNum?: number
    text: string
}

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

const MAX_LINES = 2000

function lineDiff(before: string[], after: string[]): DiffLine[] {
    const bLines = before.slice(0, MAX_LINES)
    const aLines = after.slice(0, MAX_LINES)
    const m = bLines.length
    const n = aLines.length

    // LCS DP table
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = bLines[i - 1] === aLines[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1])
        }
    }

    // Backtrack to produce diff
    const result: DiffLine[] = []
    let i = m
    let j = n
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && bLines[i - 1] === aLines[j - 1]) {
            result.unshift({ kind: 'unchanged', beforeNum: i, afterNum: j, text: bLines[i - 1] })
            i--
            j--
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ kind: 'added', afterNum: j, text: aLines[j - 1] })
            j--
        } else {
            result.unshift({ kind: 'removed', beforeNum: i, text: bLines[i - 1] })
            i--
        }
    }
    return result
}

export class DiffViewer extends HTMLElement {
    private _initialised = false
    private _before = ''
    private _after = ''

    static get observedAttributes(): string[] {
        return ['before', 'after', 'language', 'mode', 'filename']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Bootstrap backing fields from attributes when not yet set via JS
            if (!this._before) this._before = this.getAttribute('before') ?? ''
            if (!this._after) this._after = this.getAttribute('after') ?? ''
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'before') this._before = next ?? ''
        else if (name === 'after') this._after = next ?? ''
        this.render()
    }

    // `before`/`after` shadow the inherited ChildNode methods of the same name;
    // the accessor pairs are the public tc-diff-viewer API (documented + demoed).
    // @ts-expect-error TS2416/TS2423 — string accessor over an inherited method
    get before(): string {
        return this._before
    }
    // @ts-expect-error TS2416 — see getter above
    set before(v: string) {
        this._before = typeof v === 'string' ? v : ''
        if (this._initialised) this.render()
    }

    // @ts-expect-error TS2416/TS2423 — string accessor over an inherited method
    get after(): string {
        return this._after
    }
    // @ts-expect-error TS2416 — see getter above
    set after(v: string) {
        this._after = typeof v === 'string' ? v : ''
        if (this._initialised) this.render()
    }

    get language(): string | null {
        return this.getAttribute('language')
    }
    set language(v: string | null) {
        if (v != null) this.setAttribute('language', v)
        else this.removeAttribute('language')
    }

    get mode(): DiffViewerMode {
        const v = this.getAttribute('mode') as DiffViewerMode
        return MODES.includes(v) ? v : 'split'
    }
    set mode(v: DiffViewerMode) {
        this.setAttribute('mode', MODES.includes(v) ? v : 'split')
    }

    get filename(): string | null {
        return this.getAttribute('filename')
    }
    set filename(v: string | null) {
        if (v != null) this.setAttribute('filename', v)
        else this.removeAttribute('filename')
    }

    private render(): void {
        const mode = this.mode
        const filename = this.getAttribute('filename')
        const language = this.getAttribute('language')

        const bLines = this._before.split('\n')
        const aLines = this._after.split('\n')
        const diffLines = lineDiff(bLines, aLines)

        const headerHtml = (filename || language)
            ? `<div class="tc-diff-viewer__header">` +
              (filename ? `<span class="tc-diff-viewer__filename">${esc(filename)}</span>` : '') +
              (language ? `<span class="tc-diff-viewer__language">${esc(language)}</span>` : '') +
              `</div>`
            : ''

        const bodyHtml = mode === 'unified'
            ? this._renderUnified(diffLines)
            : this._renderSplit(diffLines)

        this.innerHTML = `<div class="tc-diff-viewer tc-diff-viewer--${mode}">${headerHtml}${bodyHtml}</div>`

        this.dispatchEvent(new CustomEvent('tc-render', { bubbles: true, composed: true }))
    }

    private _rowAriaLabel(kind: LineKind, text: string): string {
        if (kind === 'removed') return ` aria-label="Removed: ${esc(text)}"`
        if (kind === 'added') return ` aria-label="Added: ${esc(text)}"`
        return ''
    }

    private _renderSplit(lines: DiffLine[]): string {
        const beforeRows = lines.map(line => {
            if (line.kind === 'added') {
                return `<tr class="tc-diff-viewer__row tc-diff-viewer__row--empty" aria-hidden="true">` +
                    `<td class="tc-diff-viewer__gutter" aria-hidden="true"></td>` +
                    `<td class="tc-diff-viewer__cell"></td>` +
                    `</tr>`
            }
            const cls = line.kind === 'removed' ? ' tc-diff-viewer__row--removed' : ''
            const ariaLabel = this._rowAriaLabel(line.kind, line.text)
            return `<tr class="tc-diff-viewer__row${cls}"${ariaLabel}>` +
                `<td class="tc-diff-viewer__gutter" aria-hidden="true">${line.beforeNum ?? ''}</td>` +
                `<td class="tc-diff-viewer__cell"><pre class="tc-diff-viewer__code">${esc(line.text)}</pre></td>` +
                `</tr>`
        }).join('')

        const afterRows = lines.map(line => {
            if (line.kind === 'removed') {
                return `<tr class="tc-diff-viewer__row tc-diff-viewer__row--empty" aria-hidden="true">` +
                    `<td class="tc-diff-viewer__gutter" aria-hidden="true"></td>` +
                    `<td class="tc-diff-viewer__cell"></td>` +
                    `</tr>`
            }
            const cls = line.kind === 'added' ? ' tc-diff-viewer__row--added' : ''
            const ariaLabel = this._rowAriaLabel(line.kind, line.text)
            return `<tr class="tc-diff-viewer__row${cls}"${ariaLabel}>` +
                `<td class="tc-diff-viewer__gutter" aria-hidden="true">${line.afterNum ?? ''}</td>` +
                `<td class="tc-diff-viewer__cell"><pre class="tc-diff-viewer__code">${esc(line.text)}</pre></td>` +
                `</tr>`
        }).join('')

        return `<div class="tc-diff-viewer__split">` +
            `<div class="tc-diff-viewer__pane tc-diff-viewer__pane--before">` +
            `<table class="tc-diff-viewer__table" role="table" aria-label="Before"><tbody>${beforeRows}</tbody></table>` +
            `</div>` +
            `<div class="tc-diff-viewer__pane tc-diff-viewer__pane--after">` +
            `<table class="tc-diff-viewer__table" role="table" aria-label="After"><tbody>${afterRows}</tbody></table>` +
            `</div>` +
            `</div>`
    }

    private _renderUnified(lines: DiffLine[]): string {
        const rows = lines.map(line => {
            const prefix = line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '
            const cls = line.kind !== 'unchanged' ? ` tc-diff-viewer__row--${line.kind}` : ''
            const ariaLabel = this._rowAriaLabel(line.kind, line.text)
            return `<tr class="tc-diff-viewer__row${cls}"${ariaLabel}>` +
                `<td class="tc-diff-viewer__gutter" aria-hidden="true">${line.beforeNum ?? ''}</td>` +
                `<td class="tc-diff-viewer__gutter" aria-hidden="true">${line.afterNum ?? ''}</td>` +
                `<td class="tc-diff-viewer__prefix" aria-hidden="true">${prefix}</td>` +
                `<td class="tc-diff-viewer__cell"><pre class="tc-diff-viewer__code">${esc(line.text)}</pre></td>` +
                `</tr>`
        }).join('')

        return `<table class="tc-diff-viewer__table tc-diff-viewer__table--unified" role="table" aria-label="Unified diff">` +
            `<tbody>${rows}</tbody>` +
            `</table>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: DiffViewer
    }
}
