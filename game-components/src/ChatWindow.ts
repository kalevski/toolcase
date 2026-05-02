const TAG_NAME = 'gc-chat-window'

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
    send: CustomEvent<{ channel: string, text: string }>
    'channel-change': CustomEvent<{ id: string }>
}

export class ChatWindow extends HTMLElement {

    static get observedAttributes(): string[] {
        return ['active-channel', 'placeholder', 'width', 'height']
    }

    private _messages: ChatMessage[] = []
    private _channels: ChatChannel[] = []

    constructor() {
        super()
    }

    connectedCallback(): void {
        if (!this.hasAttribute('role')) this.setAttribute('role', 'log')
        this.render()
    }

    attributeChangedCallback(): void {
        if (this.isConnected) this.render()
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
        if (this.isConnected) {
            this.render()
            this.scrollToBottom()
        }
    }

    get channels(): ChatChannel[] {
        return this._channels.slice()
    }
    set channels(value: ChatChannel[]) {
        this._channels = Array.isArray(value) ? value.slice() : []
        if (this.isConnected) this.render()
    }

    private emit<T>(name: string, detail?: T): void {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
    }

    private escape(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;')
    }

    private scrollToBottom(): void {
        const list = this.querySelector('.gc-chat-window-messages') as HTMLElement | null
        if (list) list.scrollTop = list.scrollHeight
    }

    private render(): void {
        const width = this.width
        const height = this.height
        if (width != null) this.style.setProperty('--gc-chat-window-width', `${width}px`)
        else this.style.removeProperty('--gc-chat-window-width')
        if (height != null) this.style.setProperty('--gc-chat-window-height', `${height}px`)
        else this.style.removeProperty('--gc-chat-window-height')

        const active = this.activeChannel || (this._channels[0]?.id ?? '')

        const tabsMarkup = this._channels.length
            ? this._channels.map((c) => {
                const cls = `gc-chat-window-tab${c.id === active ? ' is-active' : ''}`
                const colorStyle = c.color ? `--gc-chat-window-tab-color:${this.escape(c.color)};` : ''
                return `<div role="tab" tabindex="0" class="${cls}" data-id="${this.escape(c.id)}" style="${colorStyle}">${this.escape(c.label)}</div>`
            }).join('')
            : ''
        const tabsBlock = tabsMarkup
            ? `<div role="tablist" class="gc-chat-window-tabs">${tabsMarkup}</div>`
            : ''

        const messagesMarkup = this._messages.map((m) => {
            const cls = `gc-chat-window-message${m.system ? ' is-system' : ''}`
            const colorStyle = m.color ? `--gc-chat-window-message-color:${this.escape(m.color)};` : ''
            if (m.system) {
                return `<div class="${cls}" data-id="${this.escape(m.id)}" style="${colorStyle}"><span class="gc-chat-window-message-body">${this.escape(m.body)}</span></div>`
            }
            return `<div class="${cls}" data-id="${this.escape(m.id)}" style="${colorStyle}"><span class="gc-chat-window-message-sender">${this.escape(m.sender)}</span><span class="gc-chat-window-message-body">${this.escape(m.body)}</span></div>`
        }).join('')

        this.innerHTML = `
            ${tabsBlock}
            <div class="gc-chat-window-messages">${messagesMarkup}</div>
            <div class="gc-chat-window-compose">
                <input type="text" class="gc-chat-window-input" placeholder="${this.escape(this.placeholder)}" />
                <button type="button" class="gc-chat-window-send">Send</button>
            </div>
        `

        this.querySelectorAll<HTMLElement>('.gc-chat-window-tab').forEach((el) => {
            const id = el.dataset.id || ''
            const fire = () => {
                this.activeChannel = id
                this.emit('channel-change', { id })
            }
            el.addEventListener('click', fire)
            el.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                fire()
            })
        })

        const input = this.querySelector('.gc-chat-window-input') as HTMLInputElement | null
        const sendBtn = this.querySelector('.gc-chat-window-send') as HTMLButtonElement | null
        const submit = () => {
            if (!input) return
            const text = input.value.trim()
            if (!text) return
            this.emit('send', { channel: active, text })
            input.value = ''
        }
        if (input) {
            input.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault()
                    submit()
                }
            })
        }
        if (sendBtn) {
            sendBtn.addEventListener('click', submit)
        }

        this.scrollToBottom()
    }
}

if (typeof customElements !== 'undefined' && !customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, ChatWindow)
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: ChatWindow
    }
}
