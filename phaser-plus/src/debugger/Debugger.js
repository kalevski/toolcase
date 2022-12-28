import { Time } from 'phaser'
import { Pane } from 'tweakpane'
import * as EssentialsPlugin from '@tweakpane/plugin-essentials'
import HTMLFeature from '../base/HTMLFeature'
import GameObjectPanel from './GameObjectPanel'
import InspectorPanel from './InspectorPanel'
import OverviewPanel from './OverviewPanel'
import LayerPanel from './LayerPanel'

class Debugger extends HTMLFeature {

    /**
     * @private
     * @type {Pane}
     */
    pane = null

    panels = {
        /** @type {InspectorPanel} */
        inspector: null,
        /** @type {OverviewPanel} */
        overview: null,
        /** @type {LayerPanel} */
        layer: null,
        /** @type {GameObjectPanel} */
        gameObject: null
    }

    /**
     * @private
     * @type {Time.TimerEvent}
     */
    updateLoop = null


    /** @private */
    onCreate() {
        this.pane = new Pane({
            title: 'Debugger'
        })
        this.pane.registerPlugin(EssentialsPlugin)
        this.panels.inspector = new InspectorPanel(this.scene, this.pane)
        this.panels.inspector.draw()
        let tabs = this.pane.addTab({
            pages: [
                { title: 'General' },
                { title: 'Flow' }
            ]
        })
        this.panels.overview = new OverviewPanel(this.scene, tabs.pages[0])
        this.panels.overview.draw()
        this.panels.overview.on('layer', this.onLayerChange, this)

        let layerFolder = this.pane.addFolder({
            title: 'Layer',
            expanded: true,
            hidden: true
        })
        this.panels.layer = new LayerPanel(this.scene, layerFolder)
        this.panels.layer.draw()
        this.panels.layer.on('layer_search', this.onLayerSearch, this)

        let gameObjectFolder = this.pane.addFolder({
            title: 'Game Object',
            expanded: true,
            hidden: false
        })
        this.panels.gameObject = new GameObjectPanel(this.scene, gameObjectFolder)
        this.panels.gameObject.draw()

        this.updateLoop = this.scene.time.addEvent({
            delay: 200,
            callback: this.onTick,
            callbackScope: this,
            loop: true
        })
        this.onTick()
    }

    onUpdate() {
        this.panels.inspector.measureFPS()
    }

    /** @private */
    onTick() {
        for (let key in this.panels) {
            let panel = this.panels[key]
            panel.doUpdate()
        }
    }

    /** @private */
    onDestroy() {
        for (let key in this.panels) {
            let panel = this.panels[key]
            panel.dispose()
        }
        this.pane.dispose()
        this.updateLoop.remove()
        this.updateLoop.destroy()
    }

    onLayerChange(key) {
        this.panels.layer.setLayer(key)
    }

    onLayerSearch(layer, input) {
        console.log(layer, input)
    }

}

export default Debugger