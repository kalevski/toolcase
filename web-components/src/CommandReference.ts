import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-command-reference'

export interface CommandFlag {
    flag: string
    description?: string
}

export interface CommandItem {
    name: string
    usage?: string
    description?: string
    flags?: CommandFlag[]
    aliases?: string[]
}

const searchIconHtml = lucideByName('search')

let _idCounter = 0

export class CommandReference extends HTMLElement {
    private _initialised = false
    private _commands: CommandItem[] = []
    private _query = ''
    private _titleNodes: Node[] = []
    private _idPrefix: string

    constructor() {
        super()
        this._idPrefix = `tc-cr-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['searchable', 'search-placeholder', 'title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleNodes = Array.from(this.childNodes)
            }
            this.render()
            if (!this.hasAttribute('title')) {
                const titleEl = this.querySelector('.tc-command-reference-title')
                if (titleEl) this._titleNodes.forEach((n) => titleEl.appendChild(n))
            }
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('input', this._onNativeInput)
    }

    disconnectedCallback(): void {
        this.removeEventListener('input', this._onNativeInput)
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get commands(): CommandItem[] {
        return this._commands
    }
    set commands(v: CommandItem[]) {
        this._commands = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    get searchable(): boolean {
        return this.getAttribute('searchable') !== 'false'
    }
    set searchable(v: boolean) {
        if (v) this.removeAttribute('searchable')
        else this.setAttribute('searchable', 'false')
    }

    get searchPlaceholder(): string {
        return this.getAttribute('search-placeholder') ?? 'Search commands…'
    }
    set searchPlaceholder(v: string) {
        this.setAttribute('search-placeholder', v)
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string | null) {
        if (v != null) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    private _onNativeInput = (e: Event): void => {
        const target = e.target as HTMLInputElement
        if (!target.classList.contains('tc-command-reference-input')) return
        this._query = target.value
        const savedVal = this._query
        this._rerenderWithSlots()
        const newInput = this.querySelector<HTMLInputElement>('.tc-command-reference-input')
        if (newInput) {
            newInput.value = savedVal
            newInput.focus()
        }
        this.dispatchEvent(
            new CustomEvent('tc-search', {
                bubbles: true,
                composed: true,
                detail: { query: this._query },
            }),
        )
    }

    private _rerenderWithSlots(): void {
        if (!this.hasAttribute('title')) {
            const titleEl = this.querySelector('.tc-command-reference-title')
            if (titleEl) this._titleNodes = Array.from(titleEl.childNodes)
        }
        this.render()
        if (!this.hasAttribute('title')) {
            const newTitleEl = this.querySelector('.tc-command-reference-title')
            if (newTitleEl) this._titleNodes.forEach((n) => newTitleEl.appendChild(n))
        }
    }

    private _filterCommands(): CommandItem[] {
        const q = this._query.trim().toLowerCase()
        if (!q) return this._commands
        return this._commands.filter((cmd) => {
            if (cmd.name.toLowerCase().includes(q)) return true
            if (cmd.description?.toLowerCase().includes(q)) return true
            if (cmd.aliases?.some((a) => a.toLowerCase().includes(q))) return true
            if (
                cmd.flags?.some(
                    (f) =>
                        f.flag.toLowerCase().includes(q) ||
                        f.description?.toLowerCase().includes(q),
                )
            )
                return true
            return false
        })
    }

    private _renderCommand(cmd: CommandItem): string {
        const nameHtml = `<span class="tc-command-reference-name">${esc(cmd.name)}</span>`
        const usageHtml = cmd.usage
            ? `<span class="tc-command-reference-usage">${esc(cmd.usage)}</span>`
            : ''
        const headerHtml = `<div class="tc-command-reference-item-header">${nameHtml}${usageHtml}</div>`

        const descHtml = cmd.description
            ? `<p class="tc-command-reference-desc">${esc(cmd.description)}</p>`
            : ''

        let aliasesHtml = ''
        if (cmd.aliases && cmd.aliases.length > 0) {
            const chips = cmd.aliases
                .map((a) => `<span class="tc-command-reference-alias">${esc(a)}</span>`)
                .join('')
            aliasesHtml =
                `<div class="tc-command-reference-aliases">` +
                `<span class="tc-command-reference-aliases-label">Aliases</span>` +
                chips +
                `</div>`
        }

        let flagsHtml = ''
        if (cmd.flags && cmd.flags.length > 0) {
            const flagItems = cmd.flags
                .map((f) => {
                    const descPart = f.description
                        ? `<span class="tc-command-reference-flag-desc">${esc(f.description)}</span>`
                        : ''
                    return (
                        `<li class="tc-command-reference-flag">` +
                        `<code class="tc-command-reference-flag-name">${esc(f.flag)}</code>` +
                        descPart +
                        `</li>`
                    )
                })
                .join('')
            flagsHtml = `<ul class="tc-command-reference-flags">${flagItems}</ul>`
        }

        return (
            `<div class="tc-command-reference-item">` +
            headerHtml +
            descHtml +
            aliasesHtml +
            flagsHtml +
            `</div>`
        )
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const titleInner = titleAttr != null ? esc(titleAttr) : ''
        const titleHtml = `<div class="tc-command-reference-title">${titleInner}</div>`

        let searchHtml = ''
        if (this.searchable) {
            const inputId = `${this._idPrefix}-search`
            searchHtml =
                `<div class="tc-command-reference-search">` +
                `<label for="${esc(inputId)}" class="visually-hidden">${esc(this.searchPlaceholder)}</label>` +
                `<div class="tc-command-reference-search-wrap">` +
                `<span class="tc-command-reference-search-icon" aria-hidden="true">${searchIconHtml}</span>` +
                `<input` +
                ` id="${esc(inputId)}"` +
                ` type="text"` +
                ` class="tc-command-reference-input"` +
                ` placeholder="${esc(this.searchPlaceholder)}"` +
                ` value="${esc(this._query)}"` +
                ` autocomplete="off"` +
                ` aria-label="${esc(this.searchPlaceholder)}"` +
                ` />` +
                `</div>` +
                `</div>`
        }

        const filtered = this._filterCommands()
        let bodyHtml: string
        if (filtered.length === 0) {
            const emptyMsg = this._query ? 'No commands match your search.' : 'No commands.'
            bodyHtml = `<div class="tc-command-reference-empty">${esc(emptyMsg)}</div>`
        } else {
            bodyHtml = filtered.map((cmd) => this._renderCommand(cmd)).join('')
        }

        const listHtml =
            `<div class="tc-command-reference-list" role="region" aria-label="Commands" tabindex="0">` +
            bodyHtml +
            `</div>`

        this.innerHTML =
            `<div class="tc-command-reference">` + titleHtml + searchHtml + listHtml + `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: CommandReference
    }
}
