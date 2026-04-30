import { Flow, Scene } from '@toolcase/phaser-plus'

class CountJob extends Flow.Job {

    progress = 0

    target = 100

    onCreate() {
        this.target = this.payload && typeof this.payload.target === 'number' ? this.payload.target : 100
    }

    onUpdate() {
        this.progress++
        this.scene.features.emit('progress', this.progress / this.target)
        return this.progress >= this.target
    }

    onComplete() {
        this.scene.features.emit('done', this.progress)
    }

    onTerminate(error) {
        this.scene.features.emit('done', -1)
    }
}

class JobQueue extends Scene {

    label = null

    bar = null

    barWidth = 600

    onCreate() {
        const { width, height } = this.game.config

        this.add.text(width / 2, 60, 'Flow.Job — cooperative work spread across frames', {
            font: '20px Courier',
            color: '#26c6da'
        }).setOrigin(0.5, 0)

        const trackX = (width - this.barWidth) / 2
        const trackY = height / 2
        this.add.rectangle(width / 2, trackY, this.barWidth, 30, 0x222222).setStrokeStyle(2, 0x26c6da)
        this.bar = this.add.rectangle(trackX, trackY, 1, 26, 0x26c6da).setOrigin(0, 0.5)

        this.label = this.add.text(width / 2, trackY + 60, '', {
            font: '18px Courier',
            color: '#ffffff'
        }).setOrigin(0.5)

        this.features.on('progress', (ratio) => {
            this.bar.width = Math.max(1, this.barWidth * ratio)
            this.label.setText(`progress: ${(ratio * 100).toFixed(0)}%`)
        }, this)

        this.features.on('done', (count) => {
            this.label.setText(`done after ${count} ticks. Press R to run again.`)
        }, this)

        this.flow.jobs.maxJobsPerFrame = 1
        this.flow.jobs.run(CountJob, { target: 240 })

        this.input.keyboard.on('keydown-R', () => this.restart())
        this.input.keyboard.on('keydown-F', () => {
            this.flow.jobs.maxJobsPerFrame = 8
            this.label.setText('maxJobsPerFrame = 8 (FAST mode)')
        })
    }
}

export default JobQueue
