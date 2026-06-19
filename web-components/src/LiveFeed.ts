import { lucideByName } from './internal/lucide'
import { esc } from './internal/esc'
import { icon } from './icons'

const TAG_NAME = 'tc-live-feed'

export interface FeedEvent {
    id?: string
    time?: string
    label: string
    level?: 'info' | 'success' | 'warning' | 'danger'
    icon?: string
}

const LEVELS: FeedEvent['level'][] = ['info', 'success', 'warning', 'danger']

// Pre-compute level icons at module load time
const levelIcons: Record<string, string> = {
    info: lucideByName('info'),
    success: lucideByName('check-circle'),
    warning: lucideByName('alert-triangle'),
    danger: lucideByName('alert-circle'),
}

export class LiveFeed extends HTMLElement {
    private _initialised = false
    private _events: FeedEvent[] = []

    onrowclick: ((detail: { id?: string; event: FeedEvent }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['header', 'recording', 'max-rows', 'auto-scroll']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            if (this.autoScroll) {
                const body = this.querySelector<HTMLElement>('.tc-live-feed-body')
                if (body) body.scrollTop = body.scrollHeight
            }
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.render()
    }

    get header(): string | null {
        return this.getAttribute('header')
    }
    set header(v: string | null) {
        if (v != null) this.setAttribute('header', v)
        else this.removeAttribute('header')
    }

    get recording(): boolean {
        return this.hasAttribute('recording')
    }
    set recording(v: boolean) {
        if (v) this.setAttribute('recording', '')
        else this.removeAttribute('recording')
    }

    get maxRows(): number {
        const v = parseInt(this.getAttribute('max-rows') ?? '0', 10)
        return Number.isFinite(v) && v > 0 ? v : 0
    }
    set maxRows(v: number) {
        if (v > 0) this.setAttribute('max-rows', String(v))
        else this.removeAttribute('max-rows')
    }

    get autoScroll(): boolean {
        return this.hasAttribute('auto-scroll')
    }
    set autoScroll(v: boolean) {
        if (v) this.setAttribute('auto-scroll', '')
        else this.removeAttribute('auto-scroll')
    }

    get events(): FeedEvent[] {
        return this._events
    }
    set events(v: FeedEvent[]) {
        this._events = Array.isArray(v) ? v : []
        if (!this._initialised) return

        const body = this.querySelector<HTMLElement>('.tc-live-feed-body')
        const prevScrollHeight = body?.scrollHeight ?? 0
        const prevScrollTop = body?.scrollTop ?? 0
        const clientHeight = body?.clientHeight ?? 0
        const nearBottom =
            prevScrollHeight > 0 ? prevScrollHeight - prevScrollTop - clientHeight < 60 : true

        this.render()

        const newBody = this.querySelector<HTMLElement>('.tc-live-feed-body')
        if (newBody) {
            if (this.autoScroll && nearBottom) {
                newBody.scrollTop = newBody.scrollHeight
            } else {
                const delta = newBody.scrollHeight - prevScrollHeight
                if (delta > 0) newBody.scrollTop = prevScrollTop + delta
            }
        }
    }

    private _visibleEvents(): FeedEvent[] {
        const maxRows = this.maxRows
        return maxRows > 0 ? this._events.slice(-maxRows) : this._events
    }

    private _onBodyClick = (e: MouseEvent): void => {
        const row = (e.target as Element).closest('[data-row-idx]')
        if (!row) return
        this._fireRowClick(row as HTMLElement)
    }

    private _onBodyKeydown = (e: KeyboardEvent): void => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        const row = (e.target as Element).closest('[data-row-idx]')
        if (!row) return
        e.preventDefault()
        this._fireRowClick(row as HTMLElement)
    }

    private _fireRowClick(row: HTMLElement): void {
        const idx = parseInt(row.dataset.rowIdx ?? '-1', 10)
        const events = this._visibleEvents()
        const ev = events[idx]
        if (!ev) return
        this.dispatchEvent(
            new CustomEvent('tc-row-click', {
                bubbles: true,
                detail: { id: ev.id, event: ev },
            }),
        )
        if (typeof this.onrowclick === 'function') this.onrowclick({ id: ev.id, event: ev })
    }

    private render(): void {
        const header = this.getAttribute('header')
        const recording = this.hasAttribute('recording')
        const events = this._visibleEvents()

        const headerHtml =
            header != null || recording
                ? `<div class="tc-live-feed-header">${
                      header != null ? `<span class="tc-live-feed-title">${esc(header)}</span>` : ''
                  }${
                      recording
                          ? `<span class="tc-live-feed-rec" role="status"><span class="tc-live-feed-rec-dot" aria-hidden="true"></span><span class="tc-live-feed-rec-label">REC<span class="visually-hidden"> recording</span></span></span>`
                          : ''
                  }</div>`
                : ''

        const rowsHtml = events
            .map((ev, idx) => {
                const levelIconHtml =
                    ev.level && LEVELS.includes(ev.level) ? (levelIcons[ev.level] ?? '') : ''
                const customIconHtml = ev.icon ? lucideByName(ev.icon) : ''
                const iconHtml = customIconHtml || levelIconHtml
                const levelClass =
                    ev.level && LEVELS.includes(ev.level) ? ` tc-live-feed-row--${ev.level}` : ''
                const timeHtml = ev.time
                    ? `<span class="tc-live-feed-time">${esc(ev.time)}</span>`
                    : ''
                const iconEl = iconHtml
                    ? `<span class="tc-live-feed-icon" aria-hidden="true">${iconHtml}</span>`
                    : ''
                const idAttr = ev.id ? ` data-row-id="${esc(ev.id)}"` : ''
                return `<div class="tc-live-feed-row${levelClass}" role="button" tabindex="0" data-row-idx="${idx}"${idAttr}>${timeHtml}${iconEl}<span class="tc-live-feed-label">${esc(ev.label)}</span></div>`
            })
            .join('')

        const ariaLabel = header ? esc(header) : 'Live feed'
        this.innerHTML = `<div class="tc-live-feed">${headerHtml}<div class="tc-live-feed-body" role="log" aria-live="polite" aria-label="${ariaLabel}">${rowsHtml}</div></div>`

        const body = this.querySelector<HTMLElement>('.tc-live-feed-body')
        if (body) {
            body.addEventListener('click', this._onBodyClick)
            body.addEventListener('keydown', this._onBodyKeydown)
        }
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: LiveFeed
    }
}
