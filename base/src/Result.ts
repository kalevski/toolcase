class Ok<T, E> {

    readonly _tag = 'ok' as const

    constructor(readonly value: T) {}

    isOk(): this is Ok<T, E> {
        return true
    }

    isErr(): this is Err<T, E> {
        return false
    }

    map<U>(fn: (v: T) => U): Ok<U, E> {
        return new Ok(fn(this.value))
    }

    mapErr<F>(_fn: (e: E) => F): Ok<T, F> {
        return this as unknown as Ok<T, F>
    }

    andThen<U>(fn: (v: T) => Result<U, E>): Result<U, E> {
        return fn(this.value)
    }

    flatMap<U>(fn: (v: T) => Result<U, E>): Result<U, E> {
        return fn(this.value)
    }

    unwrap(): T {
        return this.value
    }

    unwrapErr(): never {
        throw new Error('called unwrapErr on an Ok value')
    }

    unwrapOr(_defaultValue: T): T {
        return this.value
    }

}

class Err<T, E> {

    readonly _tag = 'err' as const

    constructor(readonly error: E) {}

    isOk(): this is Ok<T, E> {
        return false
    }

    isErr(): this is Err<T, E> {
        return true
    }

    map<U>(_fn: (v: T) => U): Err<U, E> {
        return this as unknown as Err<U, E>
    }

    mapErr<F>(fn: (e: E) => F): Err<T, F> {
        return new Err(fn(this.error))
    }

    andThen<U>(_fn: (v: T) => Result<U, E>): Err<U, E> {
        return this as unknown as Err<U, E>
    }

    flatMap<U>(_fn: (v: T) => Result<U, E>): Err<U, E> {
        return this as unknown as Err<U, E>
    }

    unwrap(): never {
        throw new Error('called unwrap on an Err value')
    }

    unwrapErr(): E {
        return this.error
    }

    unwrapOr(defaultValue: T): T {
        return defaultValue
    }

}

export type Result<T, E> = Ok<T, E> | Err<T, E>

function ok<T, E = never>(value: T): Ok<T, E> {
    return new Ok(value)
}

function err<T = never, E = unknown>(error: E): Err<T, E> {
    return new Err(error)
}

export { ok, err }
export default { ok, err }
