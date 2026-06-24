import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import { retry } from '@toolcase/base'

export const ASSET_PROGRESS = 'asset_feature.progress'
export const ASSET_LOAD_COMPLETE = 'asset_feature.load_complete'
export const ASSET_LOAD_ERROR = 'asset_feature.load_error'

export interface AssetImage {
    key: string
    url: string
}

export interface AssetAtlas {
    key: string
    textureUrl: string
    atlasUrl: string
}

export interface AssetAudio {
    key: string
    url: string | string[]
}

export interface AssetBitmapFont {
    key: string
    textureUrl: string
    fontDataUrl: string
}

export interface AssetBundle {
    images?: AssetImage[]
    atlases?: AssetAtlas[]
    audio?: AssetAudio[]
    fonts?: AssetBitmapFont[]
}

export interface AssetManifest {
    bundles: Record<string, AssetBundle>
}

type AssetType = 'image' | 'atlas' | 'audio' | 'font'

interface Entry {
    type: AssetType
    key: string
    url: string | string[]
    atlasUrl?: string
    fontDataUrl?: string
}

class AssetFeature extends Feature {

    retries = 3

    private _manifest: AssetManifest | null = null

    private _loaded: Set<string> = new Set()

    private _entries: Map<string, Entry> = new Map()

    private _loading = false

    constructor(scene: Scene, key: string) {
        super(scene, key)
        this.suppressWarning(ASSET_PROGRESS, ASSET_LOAD_COMPLETE, ASSET_LOAD_ERROR)
    }

    override onCreate(): void {}

    override onDestroy(): void {
        this._loaded.clear()
        this._entries.clear()
        this._manifest = null
    }

    define(manifest: AssetManifest): this {
        this._manifest = manifest
        this._entries.clear()
        for (const bundle of Object.values(manifest.bundles)) {
            for (const img of bundle.images ?? []) {
                this._entries.set(img.key, { type: 'image', key: img.key, url: img.url })
            }
            for (const atlas of bundle.atlases ?? []) {
                this._entries.set(atlas.key, { type: 'atlas', key: atlas.key, url: atlas.textureUrl, atlasUrl: atlas.atlasUrl })
            }
            for (const audio of bundle.audio ?? []) {
                this._entries.set(audio.key, { type: 'audio', key: audio.key, url: audio.url })
            }
            for (const font of bundle.fonts ?? []) {
                this._entries.set(font.key, { type: 'font', key: font.key, url: font.textureUrl, fontDataUrl: font.fontDataUrl })
            }
        }
        return this
    }

    async load(...bundleNames: string[]): Promise<void> {
        if (this._manifest === null) {
            throw new Error('AssetFeature: call define(manifest) before load()')
        }
        if (this._loading) {
            throw new Error('AssetFeature: load() already in progress')
        }

        const names = bundleNames.length > 0 ? bundleNames : Object.keys(this._manifest.bundles)
        const entries = this.resolveEntries(names)
        const pending = entries.filter(e => !this._loaded.has(e.key))

        if (pending.length === 0) {
            this.emit(ASSET_PROGRESS, 1)
            this.emit(ASSET_LOAD_COMPLETE, names)
            return
        }

        this._loading = true
        const total = pending.length
        let completed = 0

        try {
            await retry(
                () => {
                    const remaining = pending.filter(e => !this._loaded.has(e.key))
                    return this.doLoadBatch(remaining, (key) => {
                        this._loaded.add(key)
                        completed++
                        this.emit(ASSET_PROGRESS, completed / total)
                    })
                },
                { retries: this.retries, minTimeout: 500, factor: 2 }
            )
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err))
            this.emit(ASSET_LOAD_ERROR, error)
            throw error
        } finally {
            this._loading = false
        }

        this.emit(ASSET_LOAD_COMPLETE, names)
    }

    has(key: string): boolean {
        return this._loaded.has(key)
    }

    async reload(key: string): Promise<void> {
        const entry = this._entries.get(key)
        if (entry === undefined) {
            throw new Error(`AssetFeature: no manifest entry for key="${key}"`)
        }
        const tempKey = `__assetfeature_reload_${key}`
        const tempEntry: Entry = { ...entry, key: tempKey }
        await this.doLoadBatch([tempEntry], () => {})
        this.swapAsset(entry.type, key, tempKey)
        this._loaded.add(key)
    }

    private resolveEntries(bundleNames: string[]): Entry[] {
        if (this._manifest === null) return []
        const out: Entry[] = []
        for (const name of bundleNames) {
            const bundle = this._manifest.bundles[name]
            if (bundle === undefined) {
                this.logger.warning(`bundle="${name}" not found in manifest`)
                continue
            }
            for (const img of bundle.images ?? []) {
                out.push(this._entries.get(img.key) ?? { type: 'image', key: img.key, url: img.url })
            }
            for (const atlas of bundle.atlases ?? []) {
                out.push(this._entries.get(atlas.key) ?? { type: 'atlas', key: atlas.key, url: atlas.textureUrl, atlasUrl: atlas.atlasUrl })
            }
            for (const audio of bundle.audio ?? []) {
                out.push(this._entries.get(audio.key) ?? { type: 'audio', key: audio.key, url: audio.url })
            }
            for (const font of bundle.fonts ?? []) {
                out.push(this._entries.get(font.key) ?? { type: 'font', key: font.key, url: font.textureUrl, fontDataUrl: font.fontDataUrl })
            }
        }
        return out
    }

    private queueInLoader(entry: Entry): void {
        const loader = this.scene.load as any
        switch (entry.type) {
            case 'image':
                loader.image(entry.key, entry.url)
                break
            case 'atlas':
                loader.atlas(entry.key, entry.url, entry.atlasUrl)
                break
            case 'audio':
                loader.audio(entry.key, entry.url)
                break
            case 'font':
                loader.bitmapFont(entry.key, entry.url, entry.fontDataUrl)
                break
        }
    }

    private doLoadBatch(entries: Entry[], onFile: (key: string) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (entries.length === 0) {
                resolve()
                return
            }

            const expected = new Set(entries.map(e => e.key))
            const failed: string[] = []

            for (const entry of entries) {
                this.queueInLoader(entry)
            }

            const finish = () => {
                cleanup()
                if (failed.length > 0) {
                    reject(new Error(`Failed to load: ${failed.join(', ')}`))
                } else {
                    resolve()
                }
            }

            const onFileComplete = (key: string) => {
                if (!expected.has(key)) return
                expected.delete(key)
                onFile(key)
                if (expected.size === 0) finish()
            }

            const onError = (file: { key: string }) => {
                if (!expected.has(file.key)) return
                expected.delete(file.key)
                failed.push(file.key)
                if (expected.size === 0) finish()
            }

            const onComplete = () => {
                if (expected.size === 0) return
                const remaining = [...expected]
                cleanup()
                reject(new Error(`Loader completed with unresolved files: ${remaining.join(', ')}`))
            }

            const cleanup = () => {
                this.scene.load.off('filecomplete', onFileComplete)
                this.scene.load.off('loaderror', onError)
                this.scene.load.off('complete', onComplete)
            }

            this.scene.load.on('filecomplete', onFileComplete)
            this.scene.load.on('loaderror', onError)
            this.scene.load.on('complete', onComplete)

            ;(this.scene.load as any).start()
        })
    }

    private swapAsset(type: AssetType, key: string, tempKey: string): void {
        if (type === 'image' || type === 'atlas') {
            const textures = this.scene.textures as any
            if (textures.exists?.(key)) textures.remove?.(key)
            textures.renameTexture?.(tempKey, key)
        } else if (type === 'audio') {
            const cache = (this.scene as any).cache?.audio
            if (cache) {
                const data = cache.get?.(tempKey)
                if (data !== undefined) {
                    cache.remove?.(key)
                    cache.add?.(key, data)
                    cache.remove?.(tempKey)
                }
            }
        } else if (type === 'font') {
            const textures = this.scene.textures as any
            if (textures.exists?.(key)) textures.remove?.(key)
            textures.renameTexture?.(tempKey, key)
            const fontCache = (this.scene as any).cache?.bitmapFont
            if (fontCache) {
                const data = fontCache.get?.(tempKey)
                if (data !== undefined) {
                    fontCache.remove?.(key)
                    fontCache.add?.(key, data)
                    fontCache.remove?.(tempKey)
                }
            }
        }
    }

}

export default AssetFeature
