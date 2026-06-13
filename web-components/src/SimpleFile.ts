import * as LucideIcons from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-simple-file'

export type SimpleFileFormat = 'unknown' | 'image' | 'audio' | 'binary'
const FORMATS: SimpleFileFormat[] = ['unknown', 'image', 'audio', 'binary']

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function lucideByName(name: string): string {
    const pascal = name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    const svgStr = (LucideIcons as Record<string, string>)[pascal]
    if (!svgStr) return ''
    return icon(svgStr)
}

// Pre-computed per-format icon HTML
const FORMAT_ICONS: Record<SimpleFileFormat, string> = {
    unknown: lucideByName('file'),
    image: lucideByName('image'),
    audio: lucideByName('music'),
    binary: lucideByName('box'),
}

export class SimpleFile extends HTMLElement {
    private _initialised = false

    static get observedAttributes(): string[] {
        return ['name', 'extension', 'format']
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

    get format(): SimpleFileFormat {
        const raw = this.getAttribute('format') as SimpleFileFormat
        return FORMATS.includes(raw) ? raw : 'unknown'
    }
    set format(v: SimpleFileFormat) {
        this.setAttribute('format', FORMATS.includes(v) ? v : 'unknown')
    }

    private render(): void {
        const fmt = this.format
        const nameVal = esc(this.getAttribute('name') ?? '')
        const extVal = esc(this.getAttribute('extension') ?? '')
        const iconHtml = FORMAT_ICONS[fmt] ?? FORMAT_ICONS.unknown

        this.innerHTML =
            `<div class="tc-simple-file tc-simple-file-${fmt}">` +
                `<span class="tc-simple-file-icon" aria-hidden="true">${iconHtml}</span>` +
                `<div class="tc-simple-file-text">` +
                    `<span class="tc-simple-file-name">${nameVal}</span>` +
                    `<span class="tc-simple-file-ext">${extVal}</span>` +
                `</div>` +
            `</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: SimpleFile
    }
}
