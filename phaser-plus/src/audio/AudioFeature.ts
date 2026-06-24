import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import type Debugger from '../debugger/Debugger'
import type AudioPanel from '../debugger/panels/AudioPanel'

export const AUDIO_MUSIC_START = 'audio_feature.music_start'
export const AUDIO_MUSIC_END = 'audio_feature.music_end'
export const AUDIO_BUS_CHANGE = 'audio_feature.bus_change'

interface Bus {
    name: string
    volume: number
    mute: boolean
    pan: number
}

interface CrossfadeState {
    from: any | null
    fromStartVol: number
    to: any
    durationMs: number
    elapsed: number
}

interface FadeOutState {
    sound: any
    startVolume: number
    durationMs: number
    elapsed: number
}

interface SfxPool {
    sounds: any[]
    cursor: number
    maxVoices: number
}

interface DuckState {
    originalVolume: number
    initialDuckVolume: number
    currentDuckVolume: number
    holdMs: number
    holdElapsed: number
    restoreDurationMs: number
    restoreElapsed: number
}

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v
}

function clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v
}

class AudioFeature extends Feature {

    static readonly DEFAULT_BUSES: readonly string[] = ['music', 'sfx', 'ui', 'ambience']

    private master: Bus = { name: 'master', volume: 1, mute: false, pan: 0 }

    private buses: Map<string, Bus> = new Map()

    private currentMusic: Map<string, any | null> = new Map()

    private crossfades: Map<string, CrossfadeState> = new Map()

    private fadeOuts: Map<string, FadeOutState> = new Map()

    private sfxPools: Map<string, SfxPool> = new Map()

    private ducks: Map<string, DuckState> = new Map()

    private listenerX = 0

    private listenerY = 0

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    override onCreate(): void {
        this.suppressWarning(AUDIO_MUSIC_START, AUDIO_MUSIC_END, AUDIO_BUS_CHANGE)
        for (const name of AudioFeature.DEFAULT_BUSES) {
            this.buses.set(name, { name, volume: 1, mute: false, pan: 0 })
            this.currentMusic.set(name, null)
        }
    }

    override onUpdate(_time: number, delta: number): void {
        this.tickCrossfades(delta)
        this.tickFadeOuts(delta)
        this.tickDucks(delta)
    }

    override onDestroy(): void {
        for (const sound of this.currentMusic.values()) {
            if (sound !== null) { sound.stop(); sound.destroy() }
        }
        for (const entry of this.sfxPools.values()) {
            for (const s of entry.sounds) { s.stop(); s.destroy() }
        }
        this.currentMusic.clear()
        this.crossfades.clear()
        this.fadeOuts.clear()
        this.sfxPools.clear()
        this.ducks.clear()
        this.buses.clear()
    }

    addBus(name: string): this {
        if (!this.buses.has(name)) {
            this.buses.set(name, { name, volume: 1, mute: false, pan: 0 })
            this.currentMusic.set(name, null)
        }
        return this
    }

    removeBus(name: string): this {
        const sound = this.currentMusic.get(name) ?? null
        if (sound !== null) { sound.stop(); sound.destroy() }
        this.currentMusic.delete(name)
        this.crossfades.delete(name)
        this.fadeOuts.delete(name)
        this.ducks.delete(name)
        this.buses.delete(name)
        return this
    }

    getBus(name: string): Readonly<Bus> | null {
        return this.buses.get(name) ?? null
    }

    setMasterVolume(volume: number): this {
        this.master.volume = clamp01(volume)
        this.applyAll()
        return this
    }

    setMasterMute(mute: boolean): this {
        this.master.mute = mute
        this.applyAll()
        return this
    }

    getMasterVolume(): number { return this.master.volume }

    isMasterMute(): boolean { return this.master.mute }

    setVolume(busName: string, volume: number): this {
        const bus = this.buses.get(busName)
        if (bus === undefined) return this
        bus.volume = clamp01(volume)
        this.applyBus(busName)
        return this
    }

    setMute(busName: string, mute: boolean): this {
        const bus = this.buses.get(busName)
        if (bus === undefined) return this
        bus.mute = mute
        this.applyBus(busName)
        return this
    }

    setPan(busName: string, pan: number): this {
        const bus = this.buses.get(busName)
        if (bus === undefined) return this
        bus.pan = clamp(pan, -1, 1)
        this.applyBus(busName)
        return this
    }

    setListener(x: number, y: number): this {
        this.listenerX = x
        this.listenerY = y
        return this
    }

    play(busName: string, key: string, loop = true): void {
        if (!this.buses.has(busName)) return
        this.stopCurrentTrack(busName)
        const sound = (this.scene.sound as any).add(key, { loop })
        sound.play()
        this.currentMusic.set(busName, sound)
        this.applyBus(busName)
        this.emit(AUDIO_MUSIC_START, busName, key)
    }

    crossfadeTo(busName: string, key: string, durationMs: number, loop = true): void {
        if (!this.buses.has(busName)) return
        const prevCf = this.crossfades.get(busName)
        if (prevCf?.from !== null && prevCf?.from !== undefined) {
            prevCf.from.stop(); prevCf.from.destroy()
        }
        const from = this.currentMusic.get(busName) ?? null
        const fromVol = from !== null ? this.soundVolume(from) : 0
        const to = (this.scene.sound as any).add(key, { loop })
        to.play()
        this.setSoundVolume(to, 0)
        this.crossfades.set(busName, { from, fromStartVol: fromVol, to, durationMs, elapsed: 0 })
        this.currentMusic.set(busName, to)
        this.emit(AUDIO_MUSIC_START, busName, key)
    }

    stopMusic(busName: string, fadeDurationMs = 0): void {
        const sound = this.currentMusic.get(busName) ?? null
        if (sound === null) return
        this.currentMusic.set(busName, null)
        this.crossfades.delete(busName)
        if (fadeDurationMs <= 0) {
            sound.stop(); sound.destroy()
        } else {
            this.fadeOuts.set(busName, {
                sound,
                startVolume: this.soundVolume(sound),
                durationMs: fadeDurationMs,
                elapsed: 0
            })
        }
        this.emit(AUDIO_MUSIC_END, busName)
    }

    registerSfx(key: string, maxVoices = 4): this {
        if (this.sfxPools.has(key)) return this
        const sounds: any[] = []
        for (let i = 0; i < maxVoices; i++) {
            sounds.push((this.scene.sound as any).add(key))
        }
        this.sfxPools.set(key, { sounds, cursor: 0, maxVoices })
        return this
    }

    playSfx(busName: string, key: string): void {
        const bus = this.buses.get(busName)
        if (bus === undefined) return
        const entry = this.sfxPools.get(key)
        if (entry === undefined) {
            this.logger.warning(`sfx key "${key}" not registered — call registerSfx first`)
            return
        }
        const sound = entry.sounds[entry.cursor]
        entry.cursor = (entry.cursor + 1) % entry.maxVoices
        if (sound.isPlaying) sound.stop()
        this.setSoundVolume(sound, this.effectiveVolume(bus))
        this.setSoundPan(sound, bus.pan)
        this.setSoundMute(sound, this.master.mute || bus.mute)
        sound.play()
    }

    playSpatial(busName: string, key: string, worldX: number, worldY: number, range = 400): void {
        const bus = this.buses.get(busName)
        if (bus === undefined) return
        const dx = worldX - this.listenerX
        const dy = worldY - this.listenerY
        const distance = Math.sqrt(dx * dx + dy * dy)
        const attenuation = Math.max(0, 1 - distance / range)
        if (attenuation <= 0) return
        const entry = this.sfxPools.get(key)
        if (entry === undefined) {
            this.logger.warning(`sfx key "${key}" not registered — call registerSfx first`)
            return
        }
        const sound = entry.sounds[entry.cursor]
        entry.cursor = (entry.cursor + 1) % entry.maxVoices
        if (sound.isPlaying) sound.stop()
        this.setSoundVolume(sound, this.effectiveVolume(bus) * attenuation)
        this.setSoundPan(sound, clamp(dx / range, -1, 1))
        this.setSoundMute(sound, this.master.mute || bus.mute)
        sound.play()
    }

    duck(busName: string, duckVolume: number, holdMs: number, restoreDurationMs = 200): void {
        const bus = this.buses.get(busName)
        if (bus === undefined) return
        const existing = this.ducks.get(busName)
        const original = existing !== undefined ? existing.originalVolume : bus.volume
        const duckVol = clamp01(duckVolume)
        this.ducks.set(busName, {
            originalVolume: original,
            initialDuckVolume: duckVol,
            currentDuckVolume: duckVol,
            holdMs,
            holdElapsed: 0,
            restoreDurationMs,
            restoreElapsed: 0
        })
        this.applyBus(busName)
    }

    bindDebugger(dbg: Debugger): this {
        const audioPanel = dbg.getPanel<AudioPanel>('audio')
        if (audioPanel === null) return this
        for (const [name, bus] of this.buses) {
            audioPanel.addBus(name, (state: { volume: number, mute: boolean, pan: number }) => {
                bus.volume = state.volume
                bus.mute = state.mute
                bus.pan = state.pan
                this.applyBus(name)
                this.emit(AUDIO_BUS_CHANGE, name, bus)
            })
        }
        return this
    }

    private effectiveVolume(bus: Bus): number {
        const duck = this.ducks.get(bus.name)
        const busVol = duck !== undefined ? duck.currentDuckVolume : bus.volume
        return this.master.volume * busVol
    }

    private applyAll(): void {
        for (const name of this.buses.keys()) this.applyBus(name)
    }

    private applyBus(busName: string): void {
        const bus = this.buses.get(busName)
        if (bus === undefined) return
        const vol = this.effectiveVolume(bus)
        const mute = this.master.mute || bus.mute
        const sound = this.currentMusic.get(busName) ?? null
        if (sound !== null) {
            this.setSoundVolume(sound, vol)
            this.setSoundMute(sound, mute)
            this.setSoundPan(sound, bus.pan)
        }
    }

    private stopCurrentTrack(busName: string): void {
        const cf = this.crossfades.get(busName)
        if (cf?.from !== null && cf?.from !== undefined) {
            cf.from.stop(); cf.from.destroy()
        }
        this.crossfades.delete(busName)
        const sound = this.currentMusic.get(busName) ?? null
        if (sound !== null) { sound.stop(); sound.destroy() }
        this.currentMusic.set(busName, null)
        this.fadeOuts.delete(busName)
    }

    private tickCrossfades(delta: number): void {
        for (const [busName, cf] of this.crossfades) {
            cf.elapsed += delta
            const t = Math.min(cf.elapsed / cf.durationMs, 1)
            const bus = this.buses.get(busName)
            const targetVol = bus !== undefined ? this.effectiveVolume(bus) : 0
            const mute = bus !== undefined ? (this.master.mute || bus.mute) : false
            const pan = bus?.pan ?? 0
            if (cf.from !== null) {
                this.setSoundVolume(cf.from, cf.fromStartVol * (1 - t))
                this.setSoundMute(cf.from, mute)
            }
            this.setSoundVolume(cf.to, targetVol * t)
            this.setSoundMute(cf.to, mute)
            this.setSoundPan(cf.to, pan)
            if (t >= 1) {
                if (cf.from !== null) { cf.from.stop(); cf.from.destroy() }
                this.crossfades.delete(busName)
            }
        }
    }

    private tickFadeOuts(delta: number): void {
        for (const [busName, fo] of this.fadeOuts) {
            fo.elapsed += delta
            const t = Math.min(fo.elapsed / fo.durationMs, 1)
            this.setSoundVolume(fo.sound, fo.startVolume * (1 - t))
            if (t >= 1) {
                fo.sound.stop(); fo.sound.destroy()
                this.fadeOuts.delete(busName)
            }
        }
    }

    private tickDucks(delta: number): void {
        for (const [busName, duck] of this.ducks) {
            duck.holdElapsed += delta
            if (duck.holdElapsed < duck.holdMs) {
                duck.currentDuckVolume = duck.initialDuckVolume
            } else {
                duck.restoreElapsed += delta
                const t = Math.min(duck.restoreElapsed / duck.restoreDurationMs, 1)
                duck.currentDuckVolume = duck.initialDuckVolume + (duck.originalVolume - duck.initialDuckVolume) * t
                if (t >= 1) this.ducks.delete(busName)
            }
            this.applyBus(busName)
        }
    }

    private soundVolume(sound: any): number {
        return typeof sound.volume === 'number' ? sound.volume : 1
    }

    private setSoundVolume(sound: any, volume: number): void {
        if (typeof sound.setVolume === 'function') sound.setVolume(volume)
        else if ('volume' in sound) sound.volume = volume
    }

    private setSoundMute(sound: any, mute: boolean): void {
        if (typeof sound.setMute === 'function') sound.setMute(mute)
        else if ('mute' in sound) sound.mute = mute
    }

    private setSoundPan(sound: any, pan: number): void {
        if (typeof sound.setPan === 'function') sound.setPan(pan)
        else if ('pan' in sound) sound.pan = pan
    }

}

export default AudioFeature
