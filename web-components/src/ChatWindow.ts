import { bindOnce, patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
const TAG_NAME = 'tc-chat-window'

export interface ChatMessage {
    id: string
    channel?: string
    sender: string
    body: string
    color?: string
    system?: boolean
}

export interface ChatChannel {
    id: string
    label: string
    color?: string
}

export interface ChatWindowEventMap {
    'tc-send': CustomEvent<{ channel: string; text: string }>
    'tc-channel-change': CustomEvent<{ id: string }>
}

export class ChatWindow extends HTMLElement {
    private _initialised = false
    private _messages: ChatMessage[] = []
    private _channels: ChatChannel[] = []

    /** Optional callbacks fired alongside the matching CustomEvents. */
    onSend: ((detail: { channel: string; text: string }) => void) | null = null
    onChannelChange: ((detail: { id: string }) => void) | null = null

    static get observedAttributes(): string[] {
        return ['active-channel', 'placeholder', 'width', 'height']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this.scrollToBottom()
            this._initialised = true
        }
    }

    attributeChangedCallback(): void {
        if (!this.isConnected || !this._initialised) return
        this.rerender()
    }

    get activeChannel(): string {
        return this.getAttribute('active-channel') ?? ''
    }
    set activeChannel(v: string) {
        if (v) this.setAttribute('active-channel', v)
        else this.removeAttribute('active-channel')
    }

    get placeholder(): string {
        return this.getAttribute('placeholder') ?? 'Say something...'
    }
    set placeholder(v: string) {
        if (v) this.setAttribute('placeholder', v)
        else this.removeAttribute('placeholder')
    }

    get width(): number | null {
        const raw = this.getAttribute('width')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set width(v: number | null) {
        if (v == null) this.removeAttribute('width')
        else this.setAttribute('width', String(v))
    }

    get height(): number | null {
        const raw = this.getAttribute('height')
        if (raw == null) return null
        const parsed = parseFloat(raw)
        return Number.isFinite(parsed) ? parsed : null
    }
    set height(v: number | null) {
        if (v == null) this.removeAttribute('height')
        else this.setAttribute('height', String(v))
    }

    get messages(): ChatMessage[] {
        return this._messages.slice()
    }
    set messages(value: ChatMessage[]) {
        this._messages = Array.isArray(value) ? value.slice() : []
        if (this._initialised) {
            this.rerender()
            this.scrollToBottom()
        }
    }

    get channels(): ChatChannel[] {
        return this._channels.slice()
    }
    set channels(value: ChatChannel[]) {
        this._channels = Array.isArray(value) ? value.slice() : []
        if (this._initialised) this.rerender()
    }

    private emit(name: string, detail: { channel: string; text: string } | { id: string }): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private scrollToBottom(): void {
        const list = this.querySelector<HTMLElement>('.tc-chat-window-messages')
        if (list) list.scrollTop = list.scrollHeight
    }

    // Re-render while preserving the compose input's value, focus, and caret —
    // a full innerHTML swap would otherwise yank the cursor mid-message.
    private rerender(): void {
        const input = this.querySelector<HTMLInputElement>('.tc-chat-window-input')
        const hadFocus = input != null && document.activeElement === input
        const draft = input?.value ?? ''
        const selStart = input?.selectionStart ?? null
        const selEnd = input?.selectionEnd ?? null

        this.render()

        const next = this.querySelector<HTMLInputElement>('.tc-chat-window-input')
        if (next && draft) next.value = draft
        if (next && hadFocus) {
            next.focus()
            if (selStart != null && selEnd != null) {
                try {
                    next.setSelectionRange(selStart, selEnd)
                } catch {
                    /* setSelectionRange is unsupported on some input types */
                }
            }
        }
    }

    private render(): void {
        const width = this.width
        const height = this.height
        if (width != null) this.style.setProperty('--bs-chat-window-width', `${width}px`)
        else this.style.removeProperty('--bs-chat-window-width')
        if (height != null) this.style.setProperty('--bs-chat-window-height', `${height}px`)
        else this.style.removeProperty('--bs-chat-window-height')

        const active = this.activeChannel || (this._channels[0]?.id ?? '')

        const tabsMarkup = this._channels.length
            ? this._channels
                  .map((c) => {
                      const isActive = c.id === active
                      const cls = `tc-chat-window-tab${isActive ? ' is-active' : ''}`
                      const colorStyle = c.color
                          ? `--bs-chat-window-tab-color:${esc(c.color)};`
                          : ''
                      return `<button type="button" role="tab" aria-selected="${isActive}" class="${cls}" data-id="${esc(c.id)}" style="${colorStyle}">${esc(c.label)}</button>`
                  })
                  .join('')
            : ''
        const tabsBlock = tabsMarkup
            ? `<div role="tablist" class="tc-chat-window-tabs">${tabsMarkup}</div>`
            : ''

        const messagesMarkup = this._messages
            .map((m) => {
                const cls = `tc-chat-window-message${m.system ? ' is-system' : ''}`
                const colorStyle = m.color ? `--bs-chat-window-message-color:${esc(m.color)};` : ''
                if (m.system) {
                    return `<div class="${cls}" data-id="${esc(m.id)}" style="${colorStyle}"><span class="tc-chat-window-message-body">${esc(m.body)}</span></div>`
                }
                return `<div class="${cls}" data-id="${esc(m.id)}" style="${colorStyle}"><span class="tc-chat-window-message-sender">${esc(m.sender)}</span><span class="tc-chat-window-message-body">${esc(m.body)}</span></div>`
            })
            .join('')

        patchHtml(
            this,
            `<div class="tc-chat-window">${tabsBlock}<div class="tc-chat-window-messages" role="log" aria-live="polite">${messagesMarkup}</div><div class="tc-chat-window-compose"><input type="text" class="tc-chat-window-input" placeholder="${esc(this.placeholder)}" aria-label="Message" /><button type="button" class="tc-chat-window-send">Send</button></div></div>`,
        )

        // innerHTML was just replaced, so the previous listeners (and their
        // elements) are gone — wire the fresh DOM here, no leaks.
        const tabsEl = this.querySelector('.tc-chat-window-tabs')
        if (tabsEl) {
            bindOnce(tabsEl, 'click', (event) => {
                const tab = (event.target as Element).closest<HTMLElement>('.tc-chat-window-tab')
                if (!tab) return
                const id = tab.dataset.id || ''
                this.activeChannel = id
                this.emit('tc-channel-change', { id })
                if (typeof this.onChannelChange === 'function') this.onChannelChange({ id })
            })
        }

        const input = this.querySelector<HTMLInputElement>('.tc-chat-window-input')
        const sendBtn = this.querySelector<HTMLButtonElement>('.tc-chat-window-send')
        const submit = (): void => {
            if (!input) return
            const text = input.value.trim()
            if (!text) return
            const channel = this.activeChannel || (this._channels[0]?.id ?? '')
            this.emit('tc-send', { channel, text })
            if (typeof this.onSend === 'function') this.onSend({ channel, text })
            input.value = ''
        }
        if (input) {
            bindOnce(input, 'keydown', (event: KeyboardEvent) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    submit()
                }
            })
        }
        if (sendBtn) bindOnce(sendBtn, 'click', submit)
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ChatWindow
    }
}
