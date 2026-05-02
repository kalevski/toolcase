import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/SkillBar.scss'

export interface SkillSlot {
    id: string
    icon?: string
    hotkey?: string
    cooldown?: number
    remaining?: number
    charges?: number
    disabled?: boolean
    selected?: boolean
}

@customElement('gc-skill-bar')
export class SkillBar extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) slots: SkillSlot[] = []
    @property({ type: Number, attribute: 'slot-size' }) slotSize = 56
    @property({ type: Number }) gap = 4

    render() {
        return html`<style>:host { --gc-size: ${this.slotSize}px; --gc-gap: ${this.gap}px; }</style>
            ${this.slots.map((slot) => {
                const cd = slot.cooldown ?? 1
                const onCd = cd < 1
                return html`<button
                    class=${slot.selected ? 'selected' : ''}
                    ?disabled=${slot.disabled || onCd}
                    @click=${() => this.emit('activate', { id: slot.id })}>
                    <span class="icon">${slot.icon ?? ''}</span>
                    ${onCd ? html`<div class="cooldown" style="background: conic-gradient(rgba(0,0,0,0.6) ${(1 - cd) * 360}deg, transparent 0deg);"></div>` : nothing}
                    ${onCd && slot.remaining !== undefined ? html`<span class="remaining">${slot.remaining < 10 ? slot.remaining.toFixed(1) : Math.round(slot.remaining)}</span>` : nothing}
                    ${slot.hotkey ? html`<span class="hotkey">${slot.hotkey}</span>` : nothing}
                    ${slot.charges && slot.charges > 0 ? html`<span class="charges">${slot.charges}</span>` : nothing}
                </button>`
            })}`
    }
}
