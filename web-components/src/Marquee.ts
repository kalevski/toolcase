const TAG_NAME = 'tc-marquee'

export type MarqueeDirection = 'left' | 'right'

const DIRECTIONS: MarqueeDirection[] = ['left', 'right']
const DEFAULT_SPEED = 60

function escAttr(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export class Marquee extends HTMLElement {
    private _initialised = false
    private _items: string[] = []
    private _slotNodes: Node[] = []
    private _resizeObserver: ResizeObserver | null = null

    static get observedAttributes(): string[] {
        return ['separator', 'speed', 'direction', 'pause-on-hover']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            if (this._items.length === 0) {
                this._slotNodes = Array.from(this.childNodes).filter(n => n instanceof Element)
            }
            this.render()
            if (this._items.length === 0 && this._slotNodes.length > 0) {
                this._distributeSlotNodes()
            }
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        if (this._items.length === 0 && this._slotNodes.length > 0) {
            this._recaptureSlotNodes()
        }
        this.render()
        if (this._items.length === 0 && this._slotNodes.length > 0) {
            this._distributeSlotNodes()
        }
        this._updateDuration()
    }

    get items(): string[] {
        return this._items
    }
    set items(v: string[]) {
        this._items = Array.isArray(v) ? v : []
        if (this._initialised) {
            this.render()
            this._updateDuration()
        }
    }

    get separator(): string {
        return this.getAttribute('separator') ?? ''
    }
    set separator(v: string) {
        if (v) this.setAttribute('separator', v)
        else this.removeAttribute('separator')
    }

    get speed(): number {
        const v = parseFloat(this.getAttribute('speed') ?? '')
        return isFinite(v) && v > 0 ? v : DEFAULT_SPEED
    }
    set speed(v: number) {
        this.setAttribute('speed', String(v))
    }

    get direction(): MarqueeDirection {
        const v = this.getAttribute('direction') as MarqueeDirection
        return DIRECTIONS.includes(v) ? v : 'left'
    }
    set direction(v: MarqueeDirection) {
        this.setAttribute('direction', v)
    }

    get pauseOnHover(): boolean {
        return this.hasAttribute('pause-on-hover')
    }
    set pauseOnHover(v: boolean) {
        if (v) this.setAttribute('pause-on-hover', '')
        else this.removeAttribute('pause-on-hover')
    }

    private _attachHandlers(): void {
        this._resizeObserver?.disconnect()
        this._resizeObserver = new ResizeObserver(() => this._updateDuration())
        this._resizeObserver.observe(this)
        this._updateDuration()
    }

    private _detachHandlers(): void {
        this._resizeObserver?.disconnect()
        this._resizeObserver = null
    }

    private _recaptureSlotNodes(): void {
        const copy1 = this.querySelector('.tc-marquee-copy-1')
        if (!copy1) return
        const itemWrappers = Array.from(copy1.querySelectorAll(':scope > .tc-marquee-item'))
        this._slotNodes = itemWrappers
            .map(w => w.firstChild)
            .filter((n): n is ChildNode => n !== null)
    }

    private _distributeSlotNodes(): void {
        const copy1 = this.querySelector<HTMLElement>('.tc-marquee-copy-1')
        const copy2 = this.querySelector<HTMLElement>('.tc-marquee-copy-2')
        if (!copy1 || !copy2) return

        const sep = this.separator

        const appendItems = (container: HTMLElement, nodes: Node[], hidden: boolean): void => {
            nodes.forEach((node, idx) => {
                if (idx > 0 && sep) {
                    const sepEl = document.createElement('span')
                    sepEl.className = 'tc-marquee-sep'
                    sepEl.setAttribute('aria-hidden', 'true')
                    sepEl.textContent = sep
                    container.appendChild(sepEl)
                }
                const wrapper = document.createElement('span')
                wrapper.className = 'tc-marquee-item'
                if (hidden) wrapper.setAttribute('aria-hidden', 'true')
                wrapper.appendChild(node)
                container.appendChild(wrapper)
            })
            // Trailing separator ensures seamless visual junction between copies
            if (sep && nodes.length > 0) {
                const junctionSep = document.createElement('span')
                junctionSep.className = 'tc-marquee-sep tc-marquee-sep--junction'
                junctionSep.setAttribute('aria-hidden', 'true')
                junctionSep.textContent = sep
                container.appendChild(junctionSep)
            }
        }

        appendItems(copy1, this._slotNodes, false)
        appendItems(copy2, this._slotNodes.map(n => n.cloneNode(true)), true)
    }

    private _updateDuration(): void {
        const inner = this.querySelector<HTMLElement>('.tc-marquee')
        const copy1 = this.querySelector<HTMLElement>('.tc-marquee-copy-1')
        if (!inner || !copy1) return
        const w = copy1.offsetWidth
        const duration = w > 0 && this.speed > 0 ? w / this.speed : 10
        inner.style.setProperty('--bs-marquee-duration', `${duration}s`)
        inner.style.setProperty('--bs-marquee-direction-value', this.direction === 'right' ? 'reverse' : 'normal')
    }

    private render(): void {
        const hasItems = this._items.length > 0
        const separator = this.separator
        const ariaLabel = escAttr(this.getAttribute('aria-label') || 'Scrolling content')

        let copy1Html = ''
        let copy2Html = ''

        if (hasItems) {
            copy1Html = this._buildItemsHtml(this._items, separator, false)
            copy2Html = this._buildItemsHtml(this._items, separator, true)
        }

        this.innerHTML = `<div class="tc-marquee" role="region" aria-label="${ariaLabel}"><div class="tc-marquee-track"><span class="tc-marquee-copy-1">${copy1Html}</span><span class="tc-marquee-copy-2" aria-hidden="true">${copy2Html}</span></div></div>`
    }

    private _buildItemsHtml(items: string[], separator: string, ariaHidden: boolean): string {
        const hiddenAttr = ariaHidden ? ' aria-hidden="true"' : ''
        let html = ''
        for (let i = 0; i < items.length; i++) {
            if (i > 0 && separator) {
                html += `<span class="tc-marquee-sep" aria-hidden="true">${escHtml(separator)}</span>`
            }
            html += `<span class="tc-marquee-item"${hiddenAttr}>${items[i]}</span>`
        }
        // Trailing separator for seamless visual junction between copies
        if (separator && items.length > 0) {
            html += `<span class="tc-marquee-sep tc-marquee-sep--junction" aria-hidden="true">${escHtml(separator)}</span>`
        }
        return html
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: Marquee
    }
}
