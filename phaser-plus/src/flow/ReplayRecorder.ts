import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export interface ReplayFrame {
    tick: number
    inputs: Record<string, unknown>
}

export interface ReplaySession {
    seed: number
    fps: number
    frames: ReplayFrame[]
}

export type ReplayMode = 'idle' | 'recording' | 'playing'

export const REPLAY_FRAME = 'replay.frame'

export const REPLAY_END = 'replay.end'

export default class ReplayRecorder extends Feature {

    private mode: ReplayMode = 'idle'

    private currentTick: number = 0

    private currentSession: ReplaySession | null = null

    private playCursor: number = 0

    private currentInputs: Record<string, unknown> = {}

    private accumulator: number = 0

    private frameDt: number = 1 / 60

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setFrameRate(fps: number): this {
        if (fps <= 0) throw new Error('fps must be > 0')
        this.frameDt = 1 / fps
        return this
    }

    record(seed: number = Date.now(), fps: number = 60): ReplaySession {
        this.frameDt = 1 / fps
        this.currentSession = { seed, fps, frames: [] }
        this.currentTick = 0
        this.accumulator = 0
        this.currentInputs = {}
        this.mode = 'recording'
        return this.currentSession
    }

    play(session: ReplaySession): this {
        this.currentSession = session
        this.frameDt = 1 / session.fps
        this.currentTick = 0
        this.playCursor = 0
        this.accumulator = 0
        this.mode = 'playing'
        return this
    }

    stop(): ReplaySession | null {
        const session = this.currentSession
        this.mode = 'idle'
        return session
    }

    setInput(key: string, value: unknown): this {
        if (this.mode !== 'recording') return this
        this.currentInputs[key] = value
        return this
    }

    readInput<T = unknown>(key: string): T | undefined {
        if (this.mode === 'playing') {
            const frame = this.currentSession?.frames[this.playCursor]
            return frame?.inputs[key] as T | undefined
        }
        return this.currentInputs[key] as T | undefined
    }

    get tick(): number {
        return this.currentTick
    }

    get state(): ReplayMode {
        return this.mode
    }

    get session(): ReplaySession | null {
        return this.currentSession
    }

    override onUpdate(_time: number, delta: number): void {
        if (this.mode === 'idle') return
        this.accumulator += delta / 1000
        while (this.accumulator >= this.frameDt) {
            this.accumulator -= this.frameDt
            this.advance()
        }
    }

    private advance(): void {
        if (this.mode === 'recording') {
            this.currentSession!.frames.push({
                tick: this.currentTick,
                inputs: { ...this.currentInputs }
            })
            this.emit(REPLAY_FRAME, this.currentTick, this.currentInputs)
            this.currentInputs = {}
            this.currentTick++
            return
        }
        if (this.mode === 'playing') {
            const session = this.currentSession!
            if (this.playCursor >= session.frames.length) {
                this.mode = 'idle'
                this.emit(REPLAY_END, session)
                return
            }
            const frame = session.frames[this.playCursor]!
            this.emit(REPLAY_FRAME, frame.tick, frame.inputs)
            this.playCursor++
            this.currentTick++
        }
    }

    override onDestroy(): void {
        this.currentSession = null
        this.mode = 'idle'
    }

}
