import { CANVAS, WEBGL } from 'phaser'
import Panel from './Panel'

interface InspectorState {
    renderer: string
    recording: boolean
}

interface InspectorComponents {
    fps: any
    renderer: any
    screenshot: any
    video: any
}

export default class InspectorPanel extends Panel {

    state: InspectorState = {
        renderer: '',
        recording: false
    }

    components: InspectorComponents = {
        fps: null,
        renderer: null,
        screenshot: null,
        video: null
    }

    private recorder: MediaRecorder | null = null

    private videoChunks: Blob[] = []

    override draw(): void {
        if ((this.game.renderer as any).type === CANVAS) this.state.renderer = 'CANVAS'
        else if ((this.game.renderer as any).type === WEBGL) this.state.renderer = 'WebGL'

        this.components.renderer = this.base.addMonitor(this.state, 'renderer', { label: 'Renderer' })
        this.base.addSeparator()
        this.components.fps = this.base.addBlade({ view: 'fpsgraph', label: 'FPS Graph', lineCount: 2 })
        this.components.screenshot = this.base.addButton({ title: 'Take screenshot' }).on('click', this.onScreenshot)
        this.components.video = this.base.addButton({ title: 'Record video' }).on('click', this.onVideoRecord)
    }

    measureFPS(): void {
        this.components.fps.end()
        this.components.fps.begin()
    }

    private onScreenshot = (): void => {
        (this.game.renderer as any).snapshot((snapshot: HTMLImageElement) => {
            const a = document.createElement('a')
            a.href = snapshot.src
            a.download = 'screenshot.png'
            a.click()
        })
    }

    private onVideoRecord = (): void => {
        if (this.state.recording) {
            this.stopRecording()
            this.state.recording = false
            this.components.video.title = 'Record video'
        } else {
            this.startRecording()
            this.state.recording = true
            this.components.video.title = '[STOP] Recording...'
        }
    }

    private startRecording(): void {
        this.videoChunks = []
        const stream = (this.game.canvas as HTMLCanvasElement).captureStream(25)
        this.recorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' })
        this.recorder.start(1000)
        this.recorder.ondataavailable = (e: BlobEvent) => this.accumulateChunks(e)
    }

    private stopRecording(): void {
        if (this.recorder === null) return
        this.recorder.onstop = () => this.downloadVideo()
        this.recorder.stop()
    }

    private accumulateChunks(e: BlobEvent): void {
        this.videoChunks.push(e.data)
    }

    private downloadVideo(): void {
        const blob = new Blob(this.videoChunks, { type: 'video/webm' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.setAttribute('href', url)
        a.setAttribute('download', 'videoclip.webm')
        a.click()
    }

}
