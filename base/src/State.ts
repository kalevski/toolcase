import Broadcast from './Broadcast'

class State<T extends Record<string, any> = Record<string, any>> extends Broadcast {

    private data: Partial<T> = null as any

    constructor(data: Partial<T> = {} as Partial<T>) {
        super()
        if (!this.isObject(data)) {
            throw new Error('state must be an object')
        }
        this.data = data
    }

    get(): Partial<T> {
        return this.data
    }

    set(data: Partial<T>, emit: boolean = true): this {
        if (data === null || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`data=(${data}) must be a plain object`)
        }

        if (typeof emit !== 'boolean') {
            throw new Error(`data=(${data}) must be a boolean`)
        }

        const props = ['state']
        this.emitEvent(props, this.data, emit)
        this.setProperties(this.data as Record<string, any>, data as Record<string, any>, props, emit)
        
        return this
    }

    empty(emit: boolean = true): this {
        this.data = {} as Partial<T>
        this.emitEvent(['state'], undefined, emit)
        return this
    }

    private setProperties(target: Record<string, any>, source: Record<string, any>, properties: string[] = ['state'], emit: boolean = true): void {
        for (const key of Object.keys(source)) {
            const propertyList = [...properties, key]
            this.emitEvent(propertyList, source[key], emit)
            if (typeof target[key] === 'undefined') {
                target[key] = source[key]
                continue
            }
            
            if (this.isObject(target[key]) && this.isObject(source[key])) {
                this.setProperties(target[key], source[key], propertyList, emit)
                continue
            }
            
            if (Array.isArray(target[key]) && Array.isArray(source[key])) {
                target[key] = source[key]
                continue
            }
            
            if(typeof source[key] === 'undefined') {
                delete target[key]
            }
            
            if (typeof target[key] === 'object' || typeof source[key] === 'object') {
                throw new Error(`invalid type [${propertyList.join('.')}], source=${source[key]}, target=${target[key]}`)
            }
            
            if (target[key] !== source[key]) {
                target[key] = source[key]
            }
        }
    }

    private isObject(value: any): boolean {
        return (value && typeof value === 'object' && !Array.isArray(value))
    }

    private emitEvent(properties: string[], value: any, canEmit: boolean = true): void {
        if (!canEmit) {
            return
        }
        const eventName = properties.join('.')
        this.emit(eventName, value)
    }
}

export default State
