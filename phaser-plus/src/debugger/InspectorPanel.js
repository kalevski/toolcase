import { CANVAS, WEBGL } from 'phaser'
import Panel from './Panel'

class InspectorPanel extends Panel {

    state = {
        renderer: ''
    }

    components = {
        fps: null,
        renderer: null
    }

    draw() {
        if (this.game.renderer.type === CANVAS) {
            this.state.renderer = 'CANVAS'
        } else if (this.game.renderer.type === WEBGL) {
            this.state.renderer = 'WebGL'
        }
        this.components.renderer = this.base.addMonitor(this.state, 'renderer', {
            label: 'Renrerer'
        })
        this.base.addSeparator()
        this.components.fps = this.base.addBlade({
            view: 'fpsgraph',
            label: 'FPS Graph',
            lineCount: 2,
        })
        this.base.addButton({ title: 'Take screenshot' }).on('click', this.takeScreenshot)
    }

    measureFPS() {
        this.components.fps.end()
        this.components.fps.begin()
    }

    takeScreenshot = () => {
        this.game.renderer.snapshot(snapshot => {
            console.log('implement this')
        })
    }

}

export default InspectorPanel