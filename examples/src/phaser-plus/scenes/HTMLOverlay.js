import { HTMLFeature, Scene } from '@toolcase/phaser-plus'

class StatsHUD extends HTMLFeature {

    score = 0

    onCreate() {
        this.node.innerHTML = `
            <div style="position:absolute;top:24px;right:24px;padding:16px 24px;
                        background:rgba(0,0,0,0.7);color:#fff;border:2px solid #03dac6;
                        font-family:Courier,monospace;font-size:16px;">
                <div style="color:#03dac6;font-weight:bold;">HUD (HTMLFeature)</div>
                <div data-stats>score: 0</div>
                <div style="margin-top:12px;">
                    <button data-bump style="background:#03dac6;color:#000;border:none;
                            padding:8px 16px;font-family:Courier,monospace;cursor:pointer;">
                        +10
                    </button>
                    <button data-reset style="background:#444;color:#fff;border:none;
                            padding:8px 16px;font-family:Courier,monospace;cursor:pointer;
                            margin-left:8px;">
                        reset
                    </button>
                </div>
            </div>
        `

        this.node.querySelector('[data-bump]').addEventListener('click', () => {
            this.score += 10
            this.refresh()
        })

        this.node.querySelector('[data-reset]').addEventListener('click', () => {
            this.score = 0
            this.refresh()
        })
    }

    refresh() {
        this.node.querySelector('[data-stats]').textContent = `score: ${this.score}`
    }
}

class HTMLOverlay extends Scene {

    onLoad() {
        this.load.atlas('objects', ['/assets/objects.png'], '/assets/objects.json')
    }

    onCreate() {
        const { width, height } = this.game.config

        this.add.image(width / 2, height / 2, 'objects', 'circle_green')
        this.add.text(width / 2, height / 2 + 200, 'HUD on right is a managed <div> via HTMLFeature', {
            font: '20px Courier',
            color: '#03dac6'
        }).setOrigin(0.5)

        this.features.register('hud', StatsHUD)
    }
}

export default HTMLOverlay
