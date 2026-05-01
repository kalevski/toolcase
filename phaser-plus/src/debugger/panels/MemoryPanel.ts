import Panel from '../Panel'

interface MemoryState {
    textureMB: number
    textureCount: number
    pool: number
    objects: number
    breakdown: string
}

export default class MemoryPanel extends Panel {

    state: MemoryState = {
        textureMB: 0,
        textureCount: 0,
        pool: 0,
        objects: 0,
        breakdown: ''
    }

    components: Record<string, any> = {}

    override draw(): void {
        this.components.textureMB = this.base.addBinding(this.state, 'textureMB', { readonly: true, label: 'Textures MB' })
        this.components.textureCount = this.base.addBinding(this.state, 'textureCount', { readonly: true, label: 'Textures' })
        this.components.pool = this.base.addBinding(this.state, 'pool', { readonly: true, label: 'Pool' })
        this.components.objects = this.base.addBinding(this.state, 'objects', { readonly: true, label: 'Objects' })
        this.components.breakdown = this.base.addBinding(this.state, 'breakdown', { readonly: true, label: 'By type' })
    }

    override doUpdate(): void {
        let bytes = 0
        let count = 0
        const list = (this.game.textures as any).list ?? {}
        for (const key in list) {
            const tex = list[key]
            if (tex?.source) {
                count += 1
                for (const src of tex.source) {
                    if (typeof src.width === 'number' && typeof src.height === 'number') {
                        bytes += src.width * src.height * 4
                    }
                }
            }
        }
        this.state.textureMB = Math.round((bytes / (1024 * 1024)) * 100) / 100
        this.state.textureCount = count
        this.state.pool = this.scene.pool.instances

        const children = this.scene.children.list
        this.state.objects = children.length

        const byType: Record<string, number> = {}
        for (const child of children) {
            const t = (child as any).type ?? 'unknown'
            byType[t] = (byType[t] ?? 0) + 1
        }
        const sorted = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6)
        this.state.breakdown = sorted.map(([t, n]) => `${t}:${n}`).join(' ')

        for (const key in this.components) this.components[key].refresh?.()
    }

}
