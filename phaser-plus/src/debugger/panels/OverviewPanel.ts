import Layer from '../../features/Layer'
import Panel from '../Panel'

interface OverviewState {
    poolInstances: number
    features: number
    gameObjects: number
    layerList: { text: string, value: string }[]
    layerSelected: string | null
    layer: { objects: number }
}

interface OverviewComponents {
    poolInstances: any
    features: any
    gameObjects: any
    layerList: any
    layerSeparator: any
}

export default class OverviewPanel extends Panel {

    state: OverviewState = {
        poolInstances: 0,
        features: 0,
        gameObjects: 0,
        layerList: [],
        layerSelected: null,
        layer: { objects: 0 }
    }

    components: OverviewComponents = {
        poolInstances: null,
        features: null,
        gameObjects: null,
        layerList: null,
        layerSeparator: null
    }

    override draw(): void {
        this.components.features = this.base.addBinding(this.state, 'features', { label: 'Features', step: 1, disabled: true })
        this.components.poolInstances = this.base.addBinding(this.state, 'poolInstances', { label: 'Pool', step: 1, disabled: true })
        this.components.gameObjects = this.base.addBinding(this.state, 'gameObjects', { readonly: true, view: 'graph', label: 'Objects', max: 100, min: 0 })
        this.components.layerList = this.base.addBlade({
            view: 'list',
            label: 'Layer',
            options: this.state.layerList,
            value: ''
        })
        this.components.layerList.on('change', this.onLayerListSelect)
    }

    override doUpdate(): void {
        this.state.poolInstances = this.scene.pool.instances
        this.components.poolInstances.refresh()

        const featureKeys = this.scene.features.keys
        this.state.features = featureKeys.length
        this.state.gameObjects = 0
        const layerList: string[] = []
        for (const key of featureKeys) {
            const feature = this.scene.features.get(key)
            if (feature instanceof Layer) {
                layerList.push(feature.key)
                this.state.gameObjects += feature.list.length
            }
        }
        this.components.features.refresh()
        this.components.gameObjects.refresh()
        this.updateLayerList(layerList)
    }

    private updateLayerList(list: string[] = []): void {
        const hash = JSON.stringify(list)
        if (this.components.layerList.hash === hash) return
        this.components.layerList.hash = hash
        list.unshift('')
        this.state.layerList = list.map(key => ({ text: key, value: key }))
        this.components.layerList.options = this.state.layerList
        this.state.layerSelected = null
        this.onLayerDisplay()
    }

    private onLayerListSelect = (event: { value: string }): void => {
        this.state.layerSelected = event.value === '' ? null : event.value
        this.onLayerDisplay()
    }

    private onLayerDisplay(): void {
        this.emit('layer', this.state.layerSelected)
    }

}
