import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property, query } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/CreditsScroll.scss'

export interface CreditsSection { role: string; names: string[] }

@customElement('gc-credits-scroll')
export class CreditsScroll extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) sections: CreditsSection[] = []
    @property({ type: Number }) speed = 60
    @property({ attribute: 'scroll-title' }) scrollTitle = ''

    @query('.scroll') private _scroll!: HTMLElement
    @query('.content') private _content!: HTMLElement

    private _running = true
    private _y = 0
    private _raf = 0

    connectedCallback(): void {
        super.connectedCallback()
        const tick = () => {
            if (this._running && this._scroll && this._content) {
                this._y += this.speed * (16 / 1000)
                const max = this._content.scrollHeight + this._scroll.clientHeight
                if (this._y >= max) { this._running = false; this.emit('complete'); return }
                this._scroll.scrollTop = this._y
            }
            this._raf = requestAnimationFrame(tick)
        }
        this._raf = requestAnimationFrame(tick)
    }
    disconnectedCallback(): void { if (this._raf) cancelAnimationFrame(this._raf); super.disconnectedCallback() }

    render() {
        return html`<div class="scroll" @click=${() => { this._running = !this._running }}>
            <div class="content">
                ${this.scrollTitle ? html`<div class="title">${this.scrollTitle}</div>` : nothing}
                ${this.sections.map((s) => html`<div>
                    <div class="role">${s.role}</div>
                    ${s.names.map((n) => html`<div class="name">${n}</div>`)}
                </div>`)}
            </div>
        </div>`
    }
}
