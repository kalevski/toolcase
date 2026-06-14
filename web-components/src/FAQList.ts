import { chevronDownIcon } from './icons'

const TAG_NAME = 'tc-faq-list'

let _idCounter = 0

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export interface FAQItem {
    question: string
    answer: string
}

export class FAQList extends HTMLElement {
    private _initialised = false
    private _items: FAQItem[] = []
    private _defaultOpen: number[] = []
    private _openSet: Set<number> = new Set()
    private _idPrefix: string
    private _titleSlotNodes: Node[] = []

    onToggle: ((index: number, open: boolean) => void) | null = null

    static get observedAttributes(): string[] {
        // Note: `title` is already reflected by HTMLElement — no getter/setter defined.
        // We observe it so attributeChangedCallback fires and we can re-render.
        return ['schema', 'title']
    }

    constructor() {
        super()
        this._idPrefix = `tc-faq-list-${++_idCounter}`
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (!this.hasAttribute('title')) {
                this._titleSlotNodes = Array.from(this.childNodes)
            }
            this._openSet = new Set(this._defaultOpen)
            this.render()
            this._distributeSlots()
            this._initialised = true
        }
        this.addEventListener('click', this._onClick)
    }

    disconnectedCallback(): void {
        this.removeEventListener('click', this._onClick)
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        if (name === 'title') {
            if (!this.hasAttribute('title')) {
                const container = this.querySelector('.tc-faq-list-title-slot')
                if (container) {
                    this._titleSlotNodes = Array.from(container.childNodes)
                }
            } else {
                this._titleSlotNodes = []
            }
        }
        this.render()
        this._distributeSlots()
    }

    get items(): FAQItem[] {
        return this._items
    }
    set items(v: FAQItem[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._distributeSlots()
        }
    }

    get defaultOpen(): number[] {
        return this._defaultOpen
    }
    set defaultOpen(v: number[]) {
        this._defaultOpen = Array.isArray(v) ? v : []
        if (this._initialised) {
            this._openSet = new Set(this._defaultOpen)
            this.render()
            this._distributeSlots()
        }
    }

    get schema(): boolean {
        return this.hasAttribute('schema')
    }
    set schema(v: boolean) {
        if (v) this.setAttribute('schema', '')
        else this.removeAttribute('schema')
    }

    // title: HTMLElement.title is already a reflected attribute. No getter/setter.

    private _onClick = (e: MouseEvent): void => {
        const btn = (e.target as Element).closest<HTMLButtonElement>('button.tc-faq-list-question')
        if (!btn) return
        const idxStr = btn.dataset.idx
        if (idxStr == null) return
        const idx = parseInt(idxStr, 10)
        if (isNaN(idx)) return

        const wasOpen = this._openSet.has(idx)
        if (wasOpen) {
            this._openSet.delete(idx)
        } else {
            this._openSet.add(idx)
        }
        this._applyToggle(idx, !wasOpen)
    }

    private _applyToggle(idx: number, open: boolean): void {
        const panelId = `${this._idPrefix}-panel-${idx}`
        const btnId = `${this._idPrefix}-btn-${idx}`
        const panel = this.querySelector<HTMLElement>(`#${panelId}`)
        const btn = this.querySelector<HTMLElement>(`#${btnId}`)

        if (panel) {
            if (open) panel.removeAttribute('hidden')
            else panel.setAttribute('hidden', '')
        }
        if (btn) {
            btn.setAttribute('aria-expanded', open ? 'true' : 'false')
            btn.closest('.tc-faq-list-item')?.classList.toggle('tc-faq-list-item--open', open)
        }

        this.dispatchEvent(new CustomEvent('tc-toggle', {
            bubbles: true,
            composed: true,
            detail: { index: idx, open },
        }))
        if (typeof this.onToggle === 'function') this.onToggle(idx, open)
    }

    private _distributeSlots(): void {
        if (this._titleSlotNodes.length === 0) return
        const container = this.querySelector('.tc-faq-list-title-slot')
        if (container) this._titleSlotNodes.forEach(n => container.appendChild(n))
    }

    private render(): void {
        const titleAttr = this.getAttribute('title')
        const hasSchema = this.hasAttribute('schema')
        const items = this._items

        let titleHtml = ''
        if (titleAttr) {
            titleHtml = `<div class="tc-faq-list-title-row"><h2 class="tc-faq-list-title">${esc(titleAttr)}</h2></div>`
        } else if (this._titleSlotNodes.length > 0) {
            titleHtml = `<div class="tc-faq-list-title-row"><div class="tc-faq-list-title tc-faq-list-title-slot"></div></div>`
        }

        const itemsHtml = items.map((item, idx) => {
            const open = this._openSet.has(idx)
            const btnId = `${this._idPrefix}-btn-${idx}`
            const panelId = `${this._idPrefix}-panel-${idx}`
            const openClass = open ? ' tc-faq-list-item--open' : ''
            const hiddenAttr = open ? '' : ' hidden'
            return (
                `<div class="tc-faq-list-item${openClass}">` +
                `<button id="${btnId}" class="tc-faq-list-question" type="button" ` +
                `aria-expanded="${open ? 'true' : 'false'}" aria-controls="${panelId}" data-idx="${idx}">` +
                `<span class="tc-faq-list-question-text">${esc(item.question)}</span>` +
                `<span class="tc-faq-list-chevron" aria-hidden="true">${chevronDownIcon}</span>` +
                `</button>` +
                `<div id="${panelId}" class="tc-faq-list-answer" role="region" aria-labelledby="${btnId}"${hiddenAttr}>` +
                `${esc(item.answer)}` +
                `</div>` +
                `</div>`
            )
        }).join('\n')

        let schemaHtml = ''
        if (hasSchema && items.length > 0) {
            const schemaObj = {
                '@context': 'https://schema.org',
                '@type': 'FAQPage',
                mainEntity: items.map(item => ({
                    '@type': 'Question',
                    name: item.question,
                    acceptedAnswer: { '@type': 'Answer', text: item.answer },
                })),
            }
            // Escape </ to <\/ so the JSON string cannot prematurely close the script tag.
            schemaHtml = `<script type="application/ld+json">${JSON.stringify(schemaObj).replace(/<\//g, '<\\/')}</script>`
        }

        this.innerHTML = `<div class="tc-faq-list">${titleHtml}${itemsHtml}</div>${schemaHtml}`
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: FAQList
    }
}
