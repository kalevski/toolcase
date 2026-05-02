import { html, nothing, css, unsafeCSS } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import stylesText from '../../style/LevelSelect.scss'

export interface LevelNode {
    id: string
    x: number
    y: number
    label?: string
    icon?: string
    locked?: boolean
    completed?: boolean
    stars?: number
    bestStars?: number
}

export interface LevelEdge { from: string; to: string }

@customElement('gc-level-select')
export class LevelSelect extends GameElement {
    static styles = css`${unsafeCSS(stylesText)}`

    @property({ type: Array }) nodes: LevelNode[] = []
    @property({ type: Array }) edges: LevelEdge[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''
    @property({ type: Number }) width = 800
    @property({ type: Number }) height = 500

    render() {
        const map: Record<string, LevelNode> = Object.fromEntries(this.nodes.map((node) => [node.id, node]))
        return html`<style>:host { --gc-width: ${this.width}px; --gc-height: ${this.height}px; }</style>
            <svg width=${this.width} height=${this.height}>
                ${this.edges.map((edge) => {
                    const a = map[edge.from], b = map[edge.to]
                    if (!a || !b) return nothing
                    const completed = a.completed && b.completed
                    return html`<line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
                        stroke=${completed ? 'var(--gc-success)' : 'rgba(255,255,255,0.2)'}
                        stroke-width="2" ?stroke-dasharray=${!completed} stroke-dasharray=${!completed ? '4 4' : ''}></line>`
                })}
            </svg>
            ${this.nodes.map((node) => html`<button
                class=${node.id === this.selectedId ? 'selected' : ''}
                ?disabled=${node.locked}
                style=${`left: ${node.x}px; top: ${node.y}px; background: ${node.locked ? '#1a1c20' : node.completed ? 'var(--gc-success)' : 'var(--gc-accent)'};`}
                @click=${() => this.emit('select', { id: node.id })}
                @dblclick=${() => this.emit('confirm', { id: node.id })}>
                ${node.locked ? '🔒' : (node.icon ?? node.label ?? '')}
                ${(node.bestStars !== undefined || node.stars !== undefined) ? html`<div class="stars">
                    ${[0, 1, 2].map((i) => html`<span style=${`opacity: ${i < (node.bestStars ?? node.stars ?? 0) ? 1 : 0.25}`}>★</span>`)}
                </div>` : nothing}
            </button>`)}`
    }
}
