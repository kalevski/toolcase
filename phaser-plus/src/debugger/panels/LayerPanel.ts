import Panel from '../Panel'
import LayerHandler from '../proxies/LayerHandler'

export default class LayerPanel extends Panel {

    private readonly layerHandler: LayerHandler = new LayerHandler()

    state: { revision: number } = { revision: 0 }

    components: Record<string, any> = {
        visible: null,
        cameraXY: null,
        zoom: null,
        searchInput: null,
        searchType: null,
        findButton: null,
        childrens: null
    }

    override draw(): void {
        this.components.childrens = this.base.addBinding(this.layerHandler, 'childs', { label: 'Objects', disabled: true, step: 1 })
        this.components.visible = this.base.addBinding(this.layerHandler, 'visible')
        this.components.cameraXY = this.base.addBinding(this.layerHandler, 'camera', {
            label: 'Camera', x: {}, y: {}, expanded: false
        })
        this.components.zoom = this.base.addBinding(this.layerHandler.camera, 'zoom', { label: 'Zoom', min: 0.1, max: 3 })
        this.base.addBlade({ view: 'separator' })

        this.components.searchType = this.base.addBlade({
            view: 'list',
            label: 'Search',
            options: [{ text: 'Object by name', value: 'object_name' }],
            value: 'object_name'
        })
        this.components.searchInput = this.base.addBlade({
            view: 'text',
            label: 'Input',
            parse: (value: string) => value,
            value: ''
        })
        this.components.findButton = this.base.addButton({ title: 'Find' })
        this.components.findButton.on('click', this.onFind)
    }

    override dispose(): void {}

    setLayer(key: string | null): void {
        const layer = key !== null ? this.scene.features.get(key) : null
        if (key === null || layer === null) {
            this.base.hidden = true
            this.layerHandler.removeRef()
            return
        }
        this.base.hidden = false
        this.base.title = `Layer [${key}]`
        this.layerHandler.setRef(layer as any)
        this.refreshComponents()
        this.components.searchInput.value = ''
    }

    override doUpdate(): void {
        if (this.base.hidden) return
        this.state.revision = (this.state.revision + 1) | 0
        this.refreshComponents()
    }

    private refreshComponents(): void {
        for (const key in this.components) {
            const c = this.components[key]
            if (c && typeof c.refresh === 'function') c.refresh()
        }
    }

    private onFind = (): void => {
        const inputValue = this.components.searchInput.value
        if (inputValue === '') return
        const searchType = this.components.searchType.value
        const ref = this.layerHandler.getRef()
        if (ref !== null) {
            this.emit('layer_search', ref.key, searchType, inputValue)
        }
    }

}
