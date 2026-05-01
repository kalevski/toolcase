import { GameObjects } from 'phaser'
import Layer from '../../features/Layer'
import Panel from '../Panel'
import GameObjectHandler from '../proxies/GameObjectHandler'

export default class GameObjectPanel extends Panel {

    private objectLayer: string | null = null

    private readonly gameObjectHandler: GameObjectHandler = new GameObjectHandler()

    components: Record<string, any> = {
        id: null,
        name: null,
        type: null,
        visible: null,
        alpha: null,
        coordsXY: null,
        transformXY: null,
        scaleXY: null,
        angle: null,
        focusBtn: null
    }

    override draw(): void {
        this.components.id = this.base.addBlade({ view: 'text', disabled: true, label: 'ID', parse: (v: string) => v, value: 'N/A' })
        this.components.name = this.base.addBlade({ view: 'text', disabled: true, label: 'Name', parse: (v: string) => v, value: 'N/A' })
        this.components.type = this.base.addBlade({ view: 'text', disabled: true, label: 'Type', parse: (v: string) => v, value: 'N/A' })
        this.components.visible = this.base.addBinding(this.gameObjectHandler, 'visible')
        this.components.alpha = this.base.addBinding(this.gameObjectHandler, 'alpha', { label: 'Alpha', min: 0, max: 1 })
        this.components.coordsXY = this.base.addBinding(this.gameObjectHandler, 'position', { label: 'Position', x: {}, y: {} })
        this.components.transformXY = this.base.addBinding(this.gameObjectHandler, 'transform', { label: 'Transform', x: {}, y: {} })
        this.components.scaleXY = this.base.addBinding(this.gameObjectHandler, 'scale', {
            label: 'Scale', x: { min: 0.1, max: 10 }, y: { min: 0.1, max: 10 }
        })
        this.components.angle = this.base.addBinding(this.gameObjectHandler, 'angle', { label: 'Angle', min: 0, max: 360 })
        this.base.addBlade({ view: 'separator' })
        this.components.focusBtn = this.base.addButton({ title: 'Focus' }).on('click', this.onFocus)
    }

    findObjectByName(layerKey: string, objectName: string): void {
        const layer = this.scene.features.get<Layer>(layerKey)
        if (layer === null) return this.showPanel(false)
        const gameObject = layer.getByName(objectName)
        if (gameObject === null) return this.showPanel(false)

        this.showPanel(true)
        this.base.title = `Game Object [${objectName}]`
        this.gameObjectHandler.setRef(gameObject as any)
        this.objectLayer = layerKey
        this.refreshComponents()
    }

    override doUpdate(): void {
        if (this.base.hidden) return
        this.refreshComponents()
    }

    private showPanel(flag: boolean = true): void {
        this.base.hidden = !flag
    }

    private refreshComponents(): void {
        for (const key in this.components) {
            const c = this.components[key]
            if (c && typeof c.refresh === 'function') c.refresh()
        }
        this.components.id.value = this.gameObjectHandler.id
        this.components.name.value = this.gameObjectHandler.name
        this.components.type.value = this.gameObjectHandler.type
        const ref = this.gameObjectHandler.getRef()
        this.components.transformXY.disabled = !ref || (ref as any).transform === undefined
    }

    private onFocus = (): void => {
        const layer = this.objectLayer !== null ? this.scene.features.get<Layer>(this.objectLayer) : null
        if (layer === null) return
        layer.camera.centerOn(this.gameObjectHandler.position.x, this.gameObjectHandler.position.y)
    }

    inspect(gameObject: GameObjects.GameObject): void {
        if (gameObject instanceof GameObjects.GameObject) {
            this.gameObjectHandler.setRef(gameObject as any)
            this.base.title = `Game Object [${gameObject.type}]`
            this.showPanel(true)
        }
    }

}
