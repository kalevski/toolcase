import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-version-label'

export class VersionLabel extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['version', 'build', 'branch']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get version(): string {
        return this.getAttribute('version') ?? ''
    }
    set version(value: string) {
        if (value) this.setAttribute('version', value)
        else this.removeAttribute('version')
    }

    get build(): string {
        return this.getAttribute('build') ?? ''
    }
    set build(value: string) {
        if (value) this.setAttribute('build', value)
        else this.removeAttribute('build')
    }

    get branch(): string {
        return this.getAttribute('branch') ?? ''
    }
    set branch(value: string) {
        if (value) this.setAttribute('branch', value)
        else this.removeAttribute('branch')
    }

    private render(): void {
        this.classList.add('tc-version-label')

        const parts: string[] = []
        const version = this.version
        const build = this.build
        const branch = this.branch

        if (version) {
            parts.push(`<span class="tc-version-label-version">v${esc(version)}</span>`)
        }
        if (build) {
            parts.push(`<span class="tc-version-label-build">${esc(build)}</span>`)
        }
        if (branch) {
            parts.push(`<span class="tc-version-label-branch">${esc(branch)}</span>`)
        }

        patchHtml(
            this,
            parts.join('<span class="tc-version-label-sep" aria-hidden="true">·</span>'),
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VersionLabel
    }
}
