import { esc } from './internal/esc'
import { MessageSquare, Clock } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-good-first-issues'

export interface GoodFirstIssueLabel {
    name: string
    color?: string
}

export interface GoodFirstIssue {
    title: string
    url: string
    repo?: string
    labels?: GoodFirstIssueLabel[]
    comments?: number
    updatedAt?: string
}

const messageSquareIcon = icon(MessageSquare, 'tc-good-first-issues-meta-icon')
const clockIcon = icon(Clock, 'tc-good-first-issues-meta-icon')

function relativeTime(dateStr: string): string {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    const diff = Date.now() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days}d ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months}mo ago`
    return `${Math.floor(months / 12)}y ago`
}

export class GoodFirstIssues extends HTMLElement {
    private _initialised = false
    private _issues: GoodFirstIssue[] = []
    private _titleSlot: Element[] = []
    private _emptySlot: Element[] = []

    onIssueClick: ((issue: GoodFirstIssue) => void) | null = null

    static get observedAttributes(): string[] {
        return ['title']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this._titleSlot = Array.from(this.querySelectorAll('[slot="title"]'))
            this._emptySlot = Array.from(this.querySelectorAll('[slot="empty"]'))
            this.render()
            this._distributeSlots()
            this._attachLinkListeners()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this._rerenderWithSlots()
    }

    get title(): string {
        return this.getAttribute('title') ?? ''
    }
    set title(v: string) {
        if (v) this.setAttribute('title', v)
        else this.removeAttribute('title')
    }

    get issues(): GoodFirstIssue[] {
        return this._issues
    }
    set issues(v: GoodFirstIssue[]) {
        this._issues = Array.isArray(v) ? v : []
        if (this._initialised) this._rerenderWithSlots()
    }

    private _rerenderWithSlots(): void {
        this._titleSlot = Array.from(
            this.querySelectorAll('.tc-good-first-issues-title [slot="title"]'),
        )
        this._emptySlot = Array.from(
            this.querySelectorAll('.tc-good-first-issues-empty [slot="empty"]'),
        )
        this.render()
        this._distributeSlots()
        this._attachLinkListeners()
    }

    private _distributeSlots(): void {
        if (this._titleSlot.length > 0) {
            const titleEl = this.querySelector('.tc-good-first-issues-title')
            if (titleEl) this._titleSlot.forEach((n) => titleEl.appendChild(n))
        }
        if (this._emptySlot.length > 0) {
            const emptyEl = this.querySelector('.tc-good-first-issues-empty')
            if (emptyEl) this._emptySlot.forEach((n) => emptyEl.appendChild(n))
        }
    }

    private _attachLinkListeners(): void {
        const links = this.querySelectorAll<HTMLElement>(
            '.tc-good-first-issues-item-link[data-issue-index]',
        )
        links.forEach((link) => {
            link.addEventListener('click', () => {
                const idx = parseInt(link.getAttribute('data-issue-index') ?? '', 10)
                const issue = this._issues[idx]
                if (!issue) return
                this.dispatchEvent(
                    new CustomEvent('tc-issue-click', {
                        bubbles: true,
                        composed: true,
                        detail: { issue },
                    }),
                )
                if (typeof this.onIssueClick === 'function') this.onIssueClick(issue)
            })
        })
    }

    private _renderIssue(issue: GoodFirstIssue, i: number): string {
        const repoHtml = issue.repo
            ? `<code class="tc-good-first-issues-item-repo">${esc(issue.repo)}</code>`
            : ''

        const labelsHtml = (issue.labels ?? [])
            .map((label) => {
                const dotHtml = label.color
                    ? `<span class="tc-good-first-issues-label-dot" style="--bs-good-first-issues-label-dot-color: ${esc(label.color)}" aria-hidden="true"></span>`
                    : ''
                return `<span class="tc-good-first-issues-label">${dotHtml}${esc(label.name)}</span>`
            })
            .join('')

        const labelsRow = labelsHtml
            ? `<div class="tc-good-first-issues-item-labels">${labelsHtml}</div>`
            : ''

        const commentsHtml =
            issue.comments != null
                ? `<span class="tc-good-first-issues-meta-item" aria-label="${esc(String(issue.comments))} comments">${messageSquareIcon}<span>${esc(String(issue.comments))}</span></span>`
                : ''

        const updatedHtml = issue.updatedAt
            ? `<span class="tc-good-first-issues-meta-item" aria-label="Updated ${esc(issue.updatedAt)}">${clockIcon}<span>${esc(relativeTime(issue.updatedAt))}</span></span>`
            : ''

        const metaHtml =
            commentsHtml || updatedHtml
                ? `<div class="tc-good-first-issues-item-meta">${commentsHtml}${updatedHtml}</div>`
                : ''

        return [
            `<li class="tc-good-first-issues-item" role="listitem">`,
            `<div class="tc-good-first-issues-item-head">`,
            `<a class="tc-good-first-issues-item-link" href="${esc(issue.url)}" data-issue-index="${i}" target="_blank" rel="noopener noreferrer">${esc(issue.title)}</a>`,
            repoHtml,
            `</div>`,
            labelsRow,
            metaHtml,
            `</li>`,
        ].join('')
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const hasTitleSlot = this._titleSlot.length > 0
        const hasTitle = !!titleAttr || hasTitleSlot
        const hasEmptySlot = this._emptySlot.length > 0
        const isEmpty = this._issues.length === 0

        let headerHtml = ''
        if (hasTitle) {
            const titleInner = hasTitleSlot ? '' : esc(titleAttr!)
            headerHtml = `<div class="tc-good-first-issues-header"><span class="tc-good-first-issues-title">${titleInner}</span></div>`
        }

        let bodyHtml: string
        if (isEmpty) {
            const emptyInner = hasEmptySlot
                ? ''
                : '<span class="tc-good-first-issues-empty-text">No good first issues at the moment.</span>'
            bodyHtml = `<div class="tc-good-first-issues-empty">${emptyInner}</div>`
        } else {
            const listLabel = titleAttr ? esc(titleAttr) : 'Good first issues'
            const items = this._issues.map((issue, i) => this._renderIssue(issue, i)).join('')
            bodyHtml = `<ul class="tc-good-first-issues-list" role="list" aria-label="${listLabel}">${items}</ul>`
        }

        this.innerHTML = `<div class="tc-good-first-issues">${headerHtml}${bodyHtml}</div>`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: GoodFirstIssues
    }
}
