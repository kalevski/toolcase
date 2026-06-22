import type { SaveBackend } from './SaveBackend'
import MemoryBackend from './MemoryBackend'
import LocalStorageBackend from './LocalStorageBackend'
import IndexedDBBackend from './IndexedDBBackend'
import SaveService from './SaveService'
import type { SaveSchema, SaveEntry, SaveConfig } from './SaveService'
import PersistenceFeature, { SAVE_DONE, LOAD_DONE, SAVE_DELETED } from './PersistenceFeature'

export type { SaveBackend, SaveSchema, SaveEntry, SaveConfig }
export {
    MemoryBackend,
    LocalStorageBackend,
    IndexedDBBackend,
    SaveService,
    PersistenceFeature,
    SAVE_DONE,
    LOAD_DONE,
    SAVE_DELETED
}
