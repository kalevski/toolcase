import { html, nothing } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { GameElement } from '../base.js'
import { styles } from '../styles/SkillTree.styles.js'

export interface SkillNode {
    id: string
    x: number
    y: number
    label?: string
    icon?: string
    locked?: boolean
    unlocked?: boolean
    rank?: number
    maxRank?: number
    description?: string
}
export interface SkillEdge { from: string; to: string }

@customElement('gc-skill-tree')
export class SkillTree extends GameElement {
    static styles = styles

    @property({ type: Array }) nodes: SkillNode[] = []
    @property({ type: Array }) edges: SkillEdge[] = []
    @property({ attribute: 'selected-id' }) selectedId = ''
    @property({ type: Number }) points: number | null = null
    @property({ type: Number }) width = 720
    @property({ type: Number }) height = 480

    render() {
        const map: Record<string, SkillNode> = Object.fromEntries(this.nodes.map((node) => [node.id, node]))
        const selected = this.nodes.find((node) => node.id === this.selectedId)
        return html`<style>:host { --gc-width: ${this.width}px; --gc-height: ${this.height}px; }</style>
            ${this.points !== null ? html`<div class="points">Points: <strong>${this.points}</strong></div>` : nothing}
            <svg width=${this.width} height=${this.height}>
                ${this.edges.map((edge) => {
                    const a = map[edge.from], b = map[edge.to]
                    if (!a || !b) return nothing
                    return html`<line x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}
                        stroke=${a.unlocked && b.unlocked ? 'var(--gc-accent)' : 'rgba(255,255,255,0.15)'} stroke-width="2"></line>`
                })}
            </svg>
            ${this.nodes.map((node) => html`<button
                class=${node.id === this.selectedId ? 'selected' : ''}
                ?disabled=${node.locked}
                style=${`left: ${node.x}px; top: ${node.y}px; background: ${node.unlocked ? 'var(--gc-accent)' : node.locked ? '#1a1c20' : '#3a3f47'};`}
                @click=${() => this.emit('select', { id: node.id })}
                @dblclick=${() => !node.locked && !node.unlocked && this.emit('unlock', { id: node.id })}>
                ${node.icon ?? ''}
                ${node.maxRank && node.rank !== undefined ? html`<span class="rank">${node.rank}/${node.maxRank}</span>` : nothing}
            </button>`)}
            ${selected ? html`<div class="info">
                <div style="font-weight:700">${selected.label}</div>
                ${selected.description ? html`<div style="font-size:12px;opacity:0.8;margin-top:4px">${selected.description}</div>` : nothing}
                ${!selected.unlocked && !selected.locked ? html`<button class="unlock-btn" @click=${() => this.emit('unlock', { id: selected.id })}>Unlock</button>` : nothing}
            </div>` : nothing}`
    }
}
