import { html, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/DialogueBox.styles.js'

export interface DialogueChoice { id: string; label: string; disabled?: boolean }

@customElement('gc-dialogue-box')
export class DialogueBox extends GameElement {
    static styles = styles

    @property() speaker = ''
    @property() text = ''
    @property({ type: Array }) choices: DialogueChoice[] = []
    @property({ type: Number, attribute: 'typing-speed' }) typingSpeed = 60

    @state() private _shown = ''
    private _timer = 0

    updated(changed: Map<string, unknown>): void {
        if (changed.has('text') || changed.has('typingSpeed')) {
            if (this._timer) { window.clearInterval(this._timer); this._timer = 0 }
            if (this.typingSpeed > 0 && this.text) {
                this._shown = ''
                let i = 0
                this._timer = window.setInterval(() => {
                    i++
                    this._shown = this.text.slice(0, i)
                    if (i >= this.text.length) { window.clearInterval(this._timer); this._timer = 0 }
                }, 1000 / this.typingSpeed)
            } else {
                this._shown = this.text
            }
        }
    }

    private _onTextClick(): void {
        if (this._shown.length < this.text.length) {
            this._shown = this.text
            if (this._timer) { window.clearInterval(this._timer); this._timer = 0 }
        } else this.emit('advance')
    }

    render() {
        return html`
            <div class="portrait"><slot name="portrait"></slot></div>
            <div class="body">
                ${this.speaker ? html`<div class="speaker">${this.speaker}</div>` : nothing}
                <div class="text" @click=${this._onTextClick}>${this._shown}</div>
                ${this.choices.length ? html`<div class="choices">${this.choices.map((c) => html`
                    <button ?disabled=${c.disabled} @click=${() => this.emit('choice', { id: c.id })}>${c.label}</button>
                `)}</div>` : nothing}
            </div>`
    }
}
