import type { GameObjects, Time } from 'phaser'
import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import HTMLFeature from '../core/HTMLFeature'
import GameObjectPanel from './GameObjectPanel'
import InspectorPanel from './InspectorPanel'
import OverviewPanel from './OverviewPanel'
import LayerPanel from './LayerPanel'
import FlowPanel from './FlowPanel'
import Panel from './Panel'

const BUILT_IN_KEYS = new Set(['inspector', 'overview', 'flow', 'layer', 'gameObject'])

type PanelClass<T extends Panel> = new (scene: import('../core/Scene').default, base: any) => T

export default class Debugger extends HTMLFeature {

    static readonly Panel = Panel

    static readonly GameObjectPanel = GameObjectPanel

    private pane!: Pane

    private readonly panels: Record<string, Panel> = {}

    private updateLoop!: Time.TimerEvent

    override onCreate(): void {
        this.pane = new Pane({ title: 'Debugger', expanded: false })
        this.pane.registerPlugin(EssentialsPlugin)

        const inspector = new InspectorPanel(this.scene, this.pane)
        inspector.draw()
        this.panels.inspector = inspector

        const eventsFolder = (this.pane as any).addFolder({ title: 'Flow Events' })
        const flow = new FlowPanel(this.scene, eventsFolder)
        flow.draw()
        this.panels.flow = flow

        const overviewFolder = (this.pane as any).addFolder({ title: 'Scene Objects' })
        const overview = new OverviewPanel(this.scene, overviewFolder)
        overview.draw()
        overview.on('layer', this.onLayerChange, this)
        this.panels.overview = overview

        const layerFolder = (this.pane as any).addFolder({ title: 'Layer', expanded: true, hidden: true })
        const layer = new LayerPanel(this.scene, layerFolder)
        layer.draw()
        layer.on('layer_search', this.onLayerSearch, this)
        this.panels.layer = layer

        const gameObjectFolder = (this.pane as any).addFolder({ title: 'Game Object', expanded: true, hidden: true })
        const gameObject = new GameObjectPanel(this.scene, gameObjectFolder)
        gameObject.draw()
        this.panels.gameObject = gameObject

        this.updateLoop = this.scene.time.addEvent({
            delay: 200,
            callback: this.onTick,
            callbackScope: this,
            loop: true
        })
        this.onTick()
    }

    override onUpdate(_time: number, _delta: number): void {
        (this.panels.inspector as InspectorPanel).measureFPS()
    }

    private onTick(): void {
        for (const key in this.panels) {
            this.panels[key]!.doUpdate()
        }
    }

    override onDestroy(): void {
        for (const key in this.panels) {
            this.panels[key]!.dispose()
        }
        this.pane.dispose()
        this.updateLoop.remove()
        this.updateLoop.destroy()
    }

    private onLayerChange(key: string): void {
        (this.panels.layer as LayerPanel).setLayer(key)
    }

    private onLayerSearch(layer: string, searchType: string, inputValue: string): void {
        if (searchType === 'object_name') {
            (this.panels.gameObject as GameObjectPanel).findObjectByName(layer, inputValue)
        }
    }

    inspect(gameObject: GameObjects.GameObject): this {
        (this.panels.gameObject as GameObjectPanel).inspect(gameObject)
        return this
    }

    addPanel<T extends Panel>(key: string, panelClass: PanelClass<T>, title: string | null = null): T {
        if (typeof key !== 'string' || this.panels[key] !== undefined) {
            throw new Error(`panel key=${key} is already taken`)
        }
        const folder = (this.pane as any).addFolder({ title: title === null ? key : title })
        const panel = new panelClass(this.scene, folder)
        panel.draw()
        this.panels[key] = panel
        return panel
    }

    removePanel(key: string): this {
        if (BUILT_IN_KEYS.has(key)) {
            throw new Error(`built-in panel key=${key} cannot be removed`)
        }
        const panel = this.panels[key]
        if (!panel) return this
        panel.dispose()
        delete this.panels[key]
        return this
    }

    getPanel<T extends Panel>(key: string): T | null {
        return (this.panels[key] as T | undefined) ?? null
    }

    setExpanded(flag: boolean = true): this {
        if (typeof flag !== 'boolean') return this
        ;(this.pane as any).expanded = flag
        return this
    }

}
