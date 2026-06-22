import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import SaveService from './SaveService'
import type { SaveEntry } from './SaveService'

export const SAVE_DONE = 'persistence_feature.save_done'
export const LOAD_DONE = 'persistence_feature.load_done'
export const SAVE_DELETED = 'persistence_feature.save_deleted'

class PersistenceFeature extends Feature {

    private _service: SaveService | null = null

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    get service(): SaveService {
        if (this._service === null) throw new Error(`PersistenceFeature(${this.key}) not yet created`)
        return this._service
    }

    override onCreate(): void {
        this._service = this.scene.services.resolve(SaveService)
    }

    async save(slotId: string, data: unknown): Promise<void> {
        await this.service.save(slotId, data)
        this.emit(SAVE_DONE, slotId, data)
    }

    async load<T = unknown>(slotId: string): Promise<T | null> {
        const result = await this.service.load<T>(slotId)
        this.emit(LOAD_DONE, slotId, result)
        return result
    }

    async delete(slotId: string): Promise<void> {
        await this.service.delete(slotId)
        this.emit(SAVE_DELETED, slotId)
    }

    async list(): Promise<SaveEntry[]> {
        return this.service.list()
    }

    async has(slotId: string): Promise<boolean> {
        return this.service.has(slotId)
    }

    override onDestroy(): void {
        this._service = null
    }

}

export default PersistenceFeature
