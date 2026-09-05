import { bindOnce, patchHtml } from './internal/patch-html'
import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { msg } from './messages'

const TAG_NAME = 'tc-file-dropzone'

export interface DropzoneFileFormat {
    label: string
    mime?: string
    extension?: string
}

const uploadIconHtml = lucideByName('upload-cloud') || lucideByName('upload')

export class FileDropzone extends HTMLElement {
    private _initialised = false
    private _supported: DropzoneFileFormat[] = []

    onFiles: ((files: File[]) => void) | null = null

    static get observedAttributes(): string[] {
        return []
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
    }

    get supported(): DropzoneFileFormat[] {
        return this._supported
    }
    set supported(v: DropzoneFileFormat[]) {
        this._supported = Array.isArray(v) ? v : []
        if (this._initialised) this.render()
    }

    private _dispatch(files: File[]): void {
        this.dispatchEvent(
            new CustomEvent('tc-files', {
                bubbles: true,
                composed: true,
                detail: { files },
            }),
        )
        if (typeof this.onFiles === 'function') this.onFiles(files)
    }

    private render(): void {
        this.classList.add('tc-file-dropzone')

        const fmts = this._supported
        const accept = fmts
            .flatMap((f) => [f.mime, f.extension].filter((x): x is string => !!x))
            .join(',')

        const formatsHtml =
            fmts.length > 0
                ? `<p class="tc-file-dropzone__formats">${fmts.map((f) => `<span class="tc-file-dropzone__format-chip">${esc(f.label)}</span>`).join('')}</p>`
                : ''

        patchHtml(
            this,
            `<div class="tc-file-dropzone__area" role="button" tabindex="0" aria-label="${esc(msg('fileDropLabel'))}"><span class="tc-file-dropzone__icon" aria-hidden="true">${uploadIconHtml}</span><p class="tc-file-dropzone__prompt">${esc(msg('fileDropPrompt'))}</p>${formatsHtml}</div><input type="file" multiple class="tc-file-dropzone__input" aria-label="${esc(msg('fileSelectLabel'))}" tabindex="-1"${accept ? ` accept="${esc(accept)}"` : ''} />`,
        )

        const area = this.querySelector<HTMLElement>('.tc-file-dropzone__area')
        const input = this.querySelector<HTMLInputElement>('.tc-file-dropzone__input')

        if (!area || !input) return

        bindOnce(area, 'click', () => input.click())

        bindOnce(area, 'keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                input.click()
            }
        })

        bindOnce(area, 'dragover', (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            this.classList.add('tc-file-dropzone--active')
        })

        bindOnce(area, 'dragleave', (e: DragEvent) => {
            const related = e.relatedTarget as Node | null
            if (!related || !area.contains(related)) {
                this.classList.remove('tc-file-dropzone--active')
            }
        })

        bindOnce(area, 'drop', (e: DragEvent) => {
            e.preventDefault()
            e.stopPropagation()
            this.classList.remove('tc-file-dropzone--active')
            const files = e.dataTransfer ? Array.from(e.dataTransfer.files) : []
            if (files.length > 0) this._dispatch(files)
        })

        bindOnce(input, 'change', () => {
            const files = input.files ? Array.from(input.files) : []
            if (files.length > 0) this._dispatch(files)
            input.value = ''
        })
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FileDropzone
    }
}
