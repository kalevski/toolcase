import { patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { setAttr } from './internal/tc-element'

const TAG_NAME = 'tc-install-tabs'

export type InstallManager = 'npm' | 'yarn' | 'pnpm' | 'bun'
const MANAGERS: InstallManager[] = ['npm', 'yarn', 'pnpm', 'bun']

let _idCounter = 0

const copyIconHtml = lucideByName('copy')
const checkIconHtml = lucideByName('check')

// npm: install / install -D (dev) / install -g (global)
// yarn: add / add -D (dev) / global add (global)
// pnpm: add / add -D (dev) / add -g (global)
// bun: add / add -d (dev, lowercase) / add -g (global)
function buildCommand(manager: InstallManager, pkg: string, dev: boolean, global: boolean): string {
    switch (manager) {
        case 'npm':
            if (global) return `npm install -g ${pkg}`
            if (dev) return `npm install -D ${pkg}`
            return `npm install ${pkg}`
        case 'yarn':
            if (global) return `yarn global add ${pkg}`
            if (dev) return `yarn add -D ${pkg}`
            return `yarn add ${pkg}`
        case 'pnpm':
            if (global) return `pnpm add -g ${pkg}`
            if (dev) return `pnpm add -D ${pkg}`
            return `pnpm add ${pkg}`
        case 'bun':
            if (global) return `bun add -g ${pkg}`
            if (dev) return `bun add -d ${pkg}`
            return `bun add ${pkg}`
    }
}

export class InstallTabs extends HTMLElement {
    private _initialised = false
    private _managers: InstallManager[] = [...MANAGERS]
    private _activeManager: InstallManager | null = null
    private _copyTimer: ReturnType<typeof setTimeout> | null = null
    private _idPrefix: string

    onCopy: ((detail: { manager: InstallManager; command: string }) => void) | null = null
    onChange: ((detail: { manager: InstallManager }) => void) | null = null

    constructor() {
        super()
        this._idPrefix = `tc-it-${++_idCounter}`
    }

    static get observedAttributes(): string[] {
        return ['package', 'dev', 'global', 'default-manager']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            // Resolve the initial active manager from default-manager attribute
            const dm = this.getAttribute('default-manager') as InstallManager | null
            this._activeManager =
                dm && this._managers.includes(dm) ? dm : (this._managers[0] ?? 'npm')
            this.render()
            this._initialised = true
        }
        // Listeners are (re)attached on every connect — disconnectedCallback removes
        // them, and a move/remount (React reconciliation) disconnects then reconnects
        // without re-running the one-time init above. Re-adding the same handler
        // reference is a no-op, so this is safe to repeat.
        this.addEventListener('click', this._onHostClick)
        this.addEventListener('keydown', this._onKeydown)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onHostClick)
        this.removeEventListener('keydown', this._onKeydown)
        if (this._copyTimer !== null) {
            clearTimeout(this._copyTimer)
            this._copyTimer = null
        }
    }

    attributeChangedCallback(name: string, _old: string | null, next: string | null): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'default-manager' && next) {
            const m = next as InstallManager
            if (MANAGERS.includes(m)) this._activeManager = m
        }
        // Ensure the active manager is still in the visible set after managers may have changed
        const am = this._activeManager
        if (am === null || !this._managers.includes(am)) {
            this._activeManager = this._managers[0] ?? 'npm'
        }
        this.render()
    }

    get package(): string {
        return this.getAttribute('package') ?? ''
    }
    set package(v: string) {
        setAttr(this, 'package', v)
    }

    get dev(): boolean {
        return this.hasAttribute('dev')
    }
    set dev(v: boolean) {
        if (v) this.setAttribute('dev', '')
        else this.removeAttribute('dev')
    }

    get global(): boolean {
        return this.hasAttribute('global')
    }
    set global(v: boolean) {
        if (v) this.setAttribute('global', '')
        else this.removeAttribute('global')
    }

    get defaultManager(): InstallManager | null {
        const v = this.getAttribute('default-manager') as InstallManager | null
        return v && MANAGERS.includes(v) ? v : null
    }
    set defaultManager(v: InstallManager | null) {
        if (v) this.setAttribute('default-manager', v)
        else this.removeAttribute('default-manager')
    }

    get managers(): InstallManager[] {
        return this._managers
    }
    set managers(v: InstallManager[]) {
        this._managers = Array.isArray(v) ? v.filter((m) => MANAGERS.includes(m)) : [...MANAGERS]
        if (!this._managers.includes(this._activeManager as InstallManager)) {
            this._activeManager = this._managers[0] ?? 'npm'
        }
        if (this._initialised) this.render()
    }

    private _getActiveManager(): InstallManager {
        return this._activeManager ?? this._managers[0] ?? 'npm'
    }

    private _selectManager(manager: InstallManager): void {
        if (manager === this._activeManager) return
        this._activeManager = manager

        // Patch ARIA and tabindex in place (no full re-render)
        const tablist = this.querySelector<HTMLElement>('[role="tablist"]')
        if (!tablist) {
            this.render()
            return
        }

        this._managers.forEach((m, i) => {
            const tab = tablist.querySelector<HTMLElement>(`[data-manager="${m}"]`)
            const panel = this.querySelector<HTMLElement>(`#${this._idPrefix}-panel-${i}`)
            if (tab) {
                const isActive = m === manager
                tab.setAttribute('aria-selected', String(isActive))
                tab.setAttribute('tabindex', isActive ? '0' : '-1')
                if (isActive) {
                    tab.classList.add('tc-install-tabs-tab--active')
                } else {
                    tab.classList.remove('tc-install-tabs-tab--active')
                }
            }
            if (panel) {
                if (m === manager) {
                    panel.removeAttribute('hidden')
                    panel.setAttribute('aria-hidden', 'false')
                } else {
                    panel.setAttribute('hidden', '')
                    panel.setAttribute('aria-hidden', 'true')
                }
                // Update the command text
                if (m === manager) {
                    const codeEl = panel.querySelector<HTMLElement>('.tc-install-tabs-code')
                    const copyBtn = panel.querySelector<HTMLButtonElement>('.tc-install-tabs-copy')
                    const cmd = buildCommand(
                        m,
                        this.getAttribute('package') ?? '',
                        this.hasAttribute('dev'),
                        this.hasAttribute('global'),
                    )
                    if (codeEl) codeEl.textContent = cmd
                    if (copyBtn) copyBtn.setAttribute('data-command', cmd)
                }
            }
        })

        this.dispatchEvent(
            new CustomEvent('tc-change', {
                bubbles: true,
                composed: true,
                detail: { manager },
            }),
        )
        if (typeof this.onChange === 'function') this.onChange({ manager })
    }

    private _onHostClick = (e: Event) => {
        const target = e.target as Element

        // Tab click
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (tab) {
            const m = tab.getAttribute('data-manager') as InstallManager | null
            if (m && this._managers.includes(m)) {
                this._selectManager(m)
                tab.focus()
            }
            return
        }

        // Copy button click
        const copyBtn = target.closest<HTMLElement>('.tc-install-tabs-copy')
        if (copyBtn) {
            void this._handleCopy(copyBtn)
        }
    }

    private _onKeydown = (e: KeyboardEvent) => {
        const target = e.target as Element
        const tab = target.closest<HTMLElement>('[role="tab"]')
        if (!tab) return

        const tabs = Array.from(this.querySelectorAll<HTMLElement>('[role="tab"]'))
        const idx = tabs.indexOf(tab)
        if (idx === -1) return

        let next = -1
        if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length
        else if (e.key === 'Home') next = 0
        else if (e.key === 'End') next = tabs.length - 1
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            const m = tab.getAttribute('data-manager') as InstallManager | null
            if (m && this._managers.includes(m)) this._selectManager(m)
            return
        }

        if (next !== -1) {
            e.preventDefault()
            const nextTab = tabs[next]
            const m = nextTab.getAttribute('data-manager') as InstallManager | null
            if (m && this._managers.includes(m)) {
                this._selectManager(m)
                nextTab.focus()
            }
        }
    }

    private async _handleCopy(copyBtn: HTMLElement): Promise<void> {
        const command = copyBtn.getAttribute('data-command') ?? ''
        const manager = this._getActiveManager()

        try {
            await navigator.clipboard.writeText(command)
        } catch {
            return
        }

        this.dispatchEvent(
            new CustomEvent('tc-copy', {
                bubbles: true,
                composed: true,
                detail: { manager, command },
            }),
        )
        if (typeof this.onCopy === 'function') this.onCopy({ manager, command })

        // Briefly swap to check icon
        copyBtn.innerHTML = checkIconHtml
        copyBtn.setAttribute('aria-label', 'Copied')
        copyBtn.classList.add('tc-install-tabs-copy--copied')

        const statusEl = this.querySelector<HTMLElement>('.tc-install-tabs-status')
        if (statusEl) statusEl.textContent = 'Copied'

        if (this._copyTimer !== null) clearTimeout(this._copyTimer)
        this._copyTimer = setTimeout(() => {
            copyBtn.innerHTML = copyIconHtml
            copyBtn.setAttribute('aria-label', 'Copy command')
            copyBtn.classList.remove('tc-install-tabs-copy--copied')
            if (statusEl) statusEl.textContent = ''
            this._copyTimer = null
        }, 1500)
    }

    private render(): void {
        const pkg = this.getAttribute('package') ?? ''
        const dev = this.hasAttribute('dev')
        const global = this.hasAttribute('global')
        const activeManager = this._getActiveManager()
        const managers = this._managers.length > 0 ? this._managers : [...MANAGERS]

        const tabsHtml = managers
            .map((m, i) => {
                const tabId = `${this._idPrefix}-tab-${i}`
                const panelId = `${this._idPrefix}-panel-${i}`
                const isActive = m === activeManager
                return `<button
                id="${tabId}"
                class="tc-install-tabs-tab${isActive ? ' tc-install-tabs-tab--active' : ''}"
                role="tab"
                aria-selected="${isActive}"
                aria-controls="${panelId}"
                tabindex="${isActive ? '0' : '-1'}"
                data-manager="${m}"
                type="button"
            >${esc(m)}</button>`
            })
            .join('')

        const panelsHtml = managers
            .map((m, i) => {
                const tabId = `${this._idPrefix}-tab-${i}`
                const panelId = `${this._idPrefix}-panel-${i}`
                const isActive = m === activeManager
                const cmd = buildCommand(m, pkg, dev, global)
                return `<div
                id="${panelId}"
                class="tc-install-tabs-panel"
                role="tabpanel"
                aria-labelledby="${tabId}"
                aria-hidden="${!isActive}"
                ${!isActive ? 'hidden' : ''}
            ><pre class="tc-install-tabs-pre"><code class="tc-install-tabs-code">${esc(cmd)}</code></pre><button
                    class="tc-install-tabs-copy"
                    type="button"
                    aria-label="Copy command"
                    data-command="${esc(cmd)}"
                >${copyIconHtml}</button></div>`
            })
            .join('')

        patchHtml(
            this,
            `<div class="tc-install-tabs">` +
                `<div class="tc-install-tabs-tablist" role="tablist" aria-label="Package manager">` +
                tabsHtml +
                `</div>` +
                panelsHtml +
                `<div class="tc-install-tabs-status" role="status" aria-live="polite" aria-atomic="true"></div>` +
                `</div>`,
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: InstallTabs
    }
}
