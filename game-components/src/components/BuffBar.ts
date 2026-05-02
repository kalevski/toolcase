import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/BuffBar.scss'

export interface BuffEntry {
    id: string
    icon?: string
    name?: string
    remaining?: number
    duration?: number
    stacks?: number
    debuff?: boolean
}

@customElement('gc-buff-bar')
export class BuffBar extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) buffs: BuffEntry[] = []
    @property({ type: Number, attribute: 'icon-size' }) iconSize = 32
    @property({ type: Number }) gap = 4

    render() {
        return html`<style>:host { --gc-size: ${this.iconSize}px; --gc-gap: ${this.gap}px; }</style>
            ${this.buffs.map((b) => {
                const ratio = b.duration && b.remaining !== undefined ? Math.max(0, Math.min(1, b.remaining / b.duration)) : 1
                return html`<div class="buff ${b.debuff ? 'debuff' : ''}" title=${b.name ?? ''}>
                    <span class="icon">${b.icon ?? ''}</span>
                    ${ratio < 1 ? html`<div class="overlay" style="background: linear-gradient(to top, rgba(0,0,0,0.5) ${100 - ratio * 100}%, transparent ${100 - ratio * 100}%);"></div>` : nothing}
                    ${b.remaining !== undefined && b.remaining < 60 ? html`<span class="remaining">${Math.ceil(b.remaining)}</span>` : nothing}
                    ${b.stacks && b.stacks > 1 ? html`<span class="stacks">${b.stacks}</span>` : nothing}
                </div>`
            })}`
    }
}
