import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, state, query } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/ChatWindow.scss'

export interface ChatMessage { id: string; channel?: string; sender: string; body: string; color?: string; system?: boolean }
export interface ChatChannel { id: string; label: string; color?: string }

@customElement('gc-chat-window')
export class ChatWindow extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) messages: ChatMessage[] = []
    @property({ type: Array }) channels: ChatChannel[] = []
    @property({ attribute: 'active-channel' }) activeChannel = ''
    @property() placeholder = 'Press Enter to chat'
    @property() width = '360px'
    @property() height = '200px'

    @state() private _input = ''
    @query('.scroll') private _scroll!: HTMLElement
    @query('input') private _inputEl!: HTMLInputElement

    updated(): void {
        if (this._scroll) this._scroll.scrollTop = this._scroll.scrollHeight
    }

    private _onSubmit(event: Event): void {
        event.preventDefault()
        const channel = this.activeChannel || this.channels[0]?.id
        if (this._input && channel) {
            this.emit('send', { channel, text: this._input })
            this._input = ''
            if (this._inputEl) this._inputEl.value = ''
        }
    }

    render() {
        const active = this.activeChannel || this.channels[0]?.id
        return html`<style>:host { --gc-width: ${this.width}; --gc-height: ${this.height}; }</style>
            ${this.channels.length ? html`<div class="channels">${this.channels.map((c) => html`
                <button class=${c.id === active ? 'active' : ''} style=${c.color ? `color: ${c.color}` : ''} @click=${() => this.emit('channel-change', { id: c.id })}>${c.label}</button>
            `)}</div>` : nothing}
            <div class="scroll">${this.messages.map((m) => html`<div class="msg ${m.system ? 'system' : ''}">
                ${m.channel ? html`<span style="opacity: 0.6">[${m.channel}] </span>` : nothing}
                ${!m.system ? html`<span class="sender" style=${`color: ${m.color ?? 'var(--gc-accent)'}`}>${m.sender}: </span>` : nothing}
                <span>${m.body}</span>
            </div>`)}</div>
            <form @submit=${this._onSubmit}>
                <input placeholder=${this.placeholder} @input=${(event: Event) => { this._input = (event.target as HTMLInputElement).value }} />
            </form>`
    }
}
