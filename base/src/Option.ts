class Some<T> {

    readonly _tag = 'some' as const

    constructor(readonly value: T) {}

    isSome(): this is Some<T> {
        return true
    }

    isNone(): this is None {
        return false
    }

    map<U>(fn: (v: T) => U): Some<U> {
        return new Some(fn(this.value))
    }

    andThen<U>(fn: (v: T) => Option<U>): Option<U> {
        return fn(this.value)
    }

    flatMap<U>(fn: (v: T) => Option<U>): Option<U> {
        return fn(this.value)
    }

    unwrap(): T {
        return this.value
    }

    unwrapOr(_defaultValue: T): T {
        return this.value
    }

}

class None {

    readonly _tag = 'none' as const

    isSome(): this is Some<never> {
        return false
    }

    isNone(): this is None {
        return true
    }

    map<U>(_fn: (v: never) => U): None {
        return this
    }

    andThen<U>(_fn: (v: never) => Option<U>): None {
        return this
    }

    flatMap<U>(_fn: (v: never) => Option<U>): None {
        return this
    }

    unwrap(): never {
        throw new Error('called unwrap on a None value')
    }

    unwrapOr<T>(defaultValue: T): T {
        return defaultValue
    }

}

export type Option<T> = Some<T> | None

const NONE = new None()

function some<T>(value: T): Some<T> {
    return new Some(value)
}

function none(): None {
    return NONE
}

export { some, none }
export default { some, none }
