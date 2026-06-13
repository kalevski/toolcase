import * as LucideIcons from 'lucide-static'
import { icon, closeIcon } from './icons'

const TAG_NAME = 'tc-queued-file'

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Pre-compute — file icon is always rendered
const fileIconHtml = icon((LucideIcons as Record<string, string>)['File'] || '', 'tc-queued-file-icon-svg')

export class QueuedFile extends HTMLElement {
    private _initialised = false

    onDismiss: (() => void) | null = null

    static get observedAttributes(): string[] {
        return ['name', 'extension', 'format', 'size']
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

    get name(): string | null {
        return this.getAttribute('name')
    }
    set name(v: string | null) {
        if (v != null) this.setAttribute('name', v)
        else this.removeAttribute('name')
    }

    get extension(): string | null {
        return this.getAttribute('extension')
    }
    set extension(v: string | null) {
        if (v != null) this.setAttribute('extension', v)
        else this.removeAttribute('extension')
    }

    get format(): string | null {
        return this.getAttribute('format')
    }
    set format(v: string | null) {
        if (v != null) this.setAttribute('format', v)
        else this.removeAttribute('format')
    }

    get size(): number {
        const raw = this.getAttribute('size')
        if (raw === null) return 0
        const n = parseInt(raw, 10)
        return isNaN(n) ? 0 : n
    }
    set size(v: number) {
        this.setAttribute('size', String(v))
    }

    private _handleDismiss = (): void => {
        this.dispatchEvent(new CustomEvent('tc-dismiss', {
            bubbles: true,
            composed: true,
        }))
        if (typeof this.onDismiss === 'function') this.onDismiss()
    }

    private render(): void {
        const nameAttr = this.getAttribute('name') ?? ''
        const extAttr = this.getAttribute('extension') ?? ''
        const formatAttr = this.getAttribute('format') ?? ''
        const sizeBytes = this.size

        const ext = extAttr ? (extAttr.startsWith('.') ? extAttr : '.' + extAttr) : ''
        const fullName = esc(nameAttr + ext)
        const formatText = esc(formatAttr.toUpperCase())
        const sizeText = sizeBytes > 0 ? esc(formatBytes(sizeBytes)) : '—'
        const formatBadgeHtml = formatAttr
            ? `<span class="tc-queued-file-format">${formatText}</span>`
            : ''

        this.innerHTML =
            `<div class="tc-queued-file">` +
                `<span class="tc-queued-file-leading" aria-hidden="true">${fileIconHtml}</span>` +
                `<div class="tc-queued-file-body">` +
                    `<span class="tc-queued-file-name">${fullName}</span>` +
                    `<div class="tc-queued-file-meta">${formatBadgeHtml}` +
                        `<span class="tc-queued-file-size">${sizeText}</span>` +
                    `</div>` +
                `</div>` +
                `<button type="button" class="tc-queued-file-dismiss" aria-label="Dismiss">${closeIcon}</button>` +
            `</div>`

        const btn = this.querySelector('.tc-queued-file-dismiss')
        if (btn) btn.addEventListener('click', this._handleDismiss)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: QueuedFile
    }
}
