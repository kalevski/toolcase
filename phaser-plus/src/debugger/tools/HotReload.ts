import Panel from '../Panel'

interface HotReloadState {
    sceneKey: string
    keepPayload: boolean
    reloadCount: number
}

export default class HotReload extends Panel {

    state: HotReloadState = {
        sceneKey: '',
        keepPayload: true,
        reloadCount: 0
    }

    components: Record<string, any> = {}

    override draw(): void {
        this.state.sceneKey = this.scene.scene.key
        this.components.sceneKey = this.base.addBinding(this.state, 'sceneKey', { readonly: true, label: 'Scene' })
        this.components.keepPayload = this.base.addBinding(this.state, 'keepPayload', { label: 'Keep payload' })
        this.components.reload = this.base.addButton({ title: 'Reload scene' }).on('click', () => this.reload())
        this.components.reloadCount = this.base.addBinding(this.state, 'reloadCount', { readonly: true, label: 'Reloads' })
    }

    reload(): void {
        const key = this.scene.scene.key
        const payload = this.state.keepPayload ? this.scene.payload : null
        this.state.reloadCount += 1
        this.scene.goTo(key, payload)
    }

    override doUpdate(): void {
        this.state.sceneKey = this.scene.scene.key
        for (const key in this.components) this.components[key].refresh?.()
    }

}
