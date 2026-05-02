const TAG_NAME = 'gc-version-label'

export class VersionLabel extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['version', 'build', 'branch']
    }

    private root: ShadowRoot

    constructor() {
        super()
        this.root = this.attachShadow({ mode: 'open' })
        this.root.innerHTML = `<slot></slot>`
    }

    connectedCallback(): void {
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.render()
        }
    }

    get version(): string {
        return this.getAttribute('version') || ''
    }
    set version(value: string) {
        if (value) this.setAttribute('version', value)
        else this.removeAttribute('version')
    }

    get build(): string {
        return this.getAttribute('build') || ''
    }
    set build(value: string) {
        if (value) this.setAttribute('build', value)
        else this.removeAttribute('build')
    }

    get branch(): string {
        return this.getAttribute('branch') || ''
    }
    set branch(value: string) {
        if (value) this.setAttribute('branch', value)
        else this.removeAttribute('branch')
    }

    private render(): void {
        const parts: string[] = []
        const version = this.version
        const build = this.build
        const branch = this.branch
        if (version) {
            parts.push(`<span class="gc-version-label-version">v${this.escape(version)}</span>`)
        }
        if (build) {
            parts.push(`<span class="gc-version-label-build">build ${this.escape(build)}</span>`)
        }
        if (branch) {
            parts.push(`<span class="gc-version-label-branch">${this.escape(branch)}</span>`)
        }
        this.innerHTML = parts.join('<span class="gc-version-label-sep">·</span>')
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: VersionLabel
    }
}
